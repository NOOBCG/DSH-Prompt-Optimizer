/**
 * Host half of the composer prompt optimizer.
 *
 * The Client half renders one round control that floats just above the Send
 * button. On click the browser posts the current draft to the exact Fetch route
 * registered here (the shared authenticated /api carrier); this half performs
 * the model call through `ctx.llm` and answers with the rewritten prompt.
 *
 * Nothing is written to the session log: a draft is not a model-visible message
 * until the user sends it, so the rewrite stays a pure UI-side transformation.
 */

/** RPC channel (fallback transport); the Client half calls the same string. */
const CHANNEL = '/composer-prompt-optimizer'
const ROUTE_PATH = '/api/prompt-optimizer/optimize'
const ENDPOINT = 'optimize'

const DEFAULT_MAX_INPUT_CHARS = 12000
const DEFAULT_MAX_OUTPUT_TOKENS = 3000
const MAX_PROMPT_CHARS = 8000

/**
 * The rewrite instruction. It turns a rough chat draft into a standalone,
 * shareable prompt built from the standard blocks, and asks for the prompt in a
 * code block plus one short line of explanation.
 */
const SYSTEM_PROMPT = [
  '你是一位世界级的提示词工程师。你的任务是根据用户提供的需求，生成一个高质量、结构清晰、可直接使用的提示词。',
  '',
  '请严格按照以下步骤进行：',
  '',
  '1. 仔细分析用户的需求描述，提取关键信息：任务类型、目标受众、输出格式、风格约束、特殊要求等。',
  '2. 在生成提示词时，必须包含以下模块（如适用）：',
  '   - 角色设定：为 AI 分配一个明确的专业角色',
  '   - 任务描述：清晰说明要完成什么',
  '   - 输入说明（可选）：说明用户会提供什么材料',
  '   - 输出要求：格式、长度、风格、禁忌等',
  '   - 示例（可选）：给出一个输入-输出范例',
  '   - 步骤引导（可选）：引导 AI 分步思考',
  '3. 使用分隔符（如 --- 或 ###）清晰划分各部分。',
  '4. 提示词的语言应与用户需求的语言一致。',
  '5. 最后，直接用代码块输出完整提示词，并附带一句简短的说明。',
  '',
  '用户的需求描述如下（这是用户在输入框里写的草稿，就是你要处理的需求本身）。',
  '保留草稿中的全部具体事实、名称、路径、数字与约束，不要编造草稿里没有的信息；',
  '草稿中确实缺失、又会影响效果的关键信息，在提示词末尾用一小段"待补充信息"列出。',
].join('\n')

/**
 * Interview mode: ask only for the details whose absence would change the
 * result, and answer with a bare JSON array the Client can render as inputs.
 */
const CLARIFY_PROMPT = [
  '你是一位需求分析师。用户给出一段准备交给 AI 的粗略需求，你要找出「不补齐就会明显影响结果」的关键缺口，向用户提问。',
  '',
  '规则：',
  '- 默认只问 2 到 4 个问题：需求简单就问 2 个，需求复杂可以增加到最多 6 个；宁少勿多。',
  '- 只问真正影响输出的点：目标产物形态、目标受众、范围边界、格式与禁用项、验收标准。',
  '- 每个问题一句话，具体、可回答；不要问能靠常识判断的东西，不要问已有信息。',
  '- 每个问题再给 3 个最常见、互不重复的候选答案，让用户可以直接点选。',
  '- 只输出 JSON 数组，元素形如 {"question":"问题","options":["选项1","选项2","选项3"]}。',
  '- 不要解释，不要 Markdown，不要代码块。',
].join('\n')

function failure(code, message) {
  return { ok: false, error: { code, message, details: {} } }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export const inject = []

export function apply(ctx, config) {
  const options = config && typeof config === 'object' ? config : {}
  const maxInputChars = Number.isFinite(options.maxInputChars)
    ? options.maxInputChars
    : DEFAULT_MAX_INPUT_CHARS
  const maxOutputTokens = Number.isFinite(options.maxOutputTokens)
    ? options.maxOutputTokens
    : DEFAULT_MAX_OUTPUT_TOKENS

  async function optimize(text, signal, systemPrompt) {
    const llm = ctx.get('llm')
    if (!llm) {
      return failure('llm-unavailable', 'This profile mounts no model service (ctx.llm).')
    }
    const defaults = ctx.get('agentDefaultModel')
    const selection = defaults ? defaults.currentSelection() : undefined
    const provider = selection && selection.provider
    const model = selection && selection.model
    if (!provider || !model) {
      return failure(
        'model-unavailable',
        'No default model is configured for this profile, so the draft cannot be rewritten.',
      )
    }

    let out = ''
    let terminal
    try {
      const stream = llm.stream({
        provider,
        model,
        system: systemPrompt,
        temperature: 0.2,
        maxTokens: maxOutputTokens,
        messages: [{ role: 'user', content: [{ type: 'text', text }] }],
        signal,
      })
      for await (const chunk of stream) {
        if (chunk && chunk.type === 'text-delta') {
          out += chunk.text
        } else if (chunk && chunk.type === 'finish') {
          terminal = chunk.reason
        }
      }
    } catch (error) {
      return failure('llm-threw', (error && error.message) || String(error))
    }

    if (terminal && (terminal.kind === 'error' || terminal.kind === 'aborted')) {
      const cause = terminal.failure || {}
      return failure(
        typeof cause.code === 'string' ? cause.code : 'llm-failure',
        typeof cause.message === 'string' ? cause.message : 'The model call failed.',
      )
    }
    const optimized = out.trim()
    if (!optimized) {
      return failure('empty-result', 'The model returned no text for this draft.')
    }
    return { ok: true, value: { text: optimized } }
  }

  async function runOptimize(payload, signal) {
    const draft = payload && typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!draft) return failure('empty-draft', 'The composer draft is empty.')
    if (draft.length > maxInputChars) {
      return failure(
        'draft-too-long',
        `The draft is ${draft.length} characters; the limit is ${maxInputChars}.`,
      )
    }
    // The Settings page owns the rewrite instruction; the built-in default is
    // the fallback when the page was never configured (or is cleared).
    const custom =
      payload && typeof payload.promptContent === 'string' ? payload.promptContent.trim() : ''
    const systemPrompt = custom ? custom.slice(0, MAX_PROMPT_CHARS) : SYSTEM_PROMPT
    return optimize(draft, signal, systemPrompt)
  }

  /** Interview mode step 1: ask the model which details it needs from the user. */
  async function runClarify(payload, signal) {
    const draft = payload && typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!draft) return failure('empty-draft', 'The composer draft is empty.')

    const llm = ctx.get('llm')
    if (!llm) return failure('llm-unavailable', 'This profile mounts no model service (ctx.llm).')
    const defaults = ctx.get('agentDefaultModel')
    const selection = defaults ? defaults.currentSelection() : undefined
    const provider = selection && selection.provider
    const model = selection && selection.model
    if (!provider || !model) {
      return failure('model-unavailable', 'No default model is configured for this profile.')
    }

    let out = ''
    let terminal
    try {
      const stream = llm.stream({
        provider,
        model,
        system: CLARIFY_PROMPT,
        temperature: 0.3,
        maxTokens: 800,
        messages: [{ role: 'user', content: [{ type: 'text', text: draft }] }],
        signal,
      })
      for await (const chunk of stream) {
        if (chunk && chunk.type === 'text-delta') out += chunk.text
        else if (chunk && chunk.type === 'finish') terminal = chunk.reason
      }
    } catch (error) {
      return failure('llm-threw', (error && error.message) || String(error))
    }
    if (terminal && (terminal.kind === 'error' || terminal.kind === 'aborted')) {
      const cause = terminal.failure || {}
      return failure(
        typeof cause.code === 'string' ? cause.code : 'llm-failure',
        typeof cause.message === 'string' ? cause.message : 'The model call failed.',
      )
    }
    return { ok: true, value: { questions: parseQuestions(out) } }
  }

  /** Interview mode step 2: fold the answers into the final Markdown prompt. */
  async function runFinalize(payload, signal) {
    const draft = payload && typeof payload.text === 'string' ? payload.text.trim() : ''
    if (!draft) return failure('empty-draft', 'The composer draft is empty.')
    const answers = Array.isArray(payload && payload.answers) ? payload.answers : []
    const lines = ['用户需求原文：', draft, '', '---', '补充信息（用户回答）：']
    answers.forEach((entry) => {
      const question = entry && typeof entry.question === 'string' ? entry.question.trim() : ''
      const answer = entry && typeof entry.answer === 'string' ? entry.answer.trim() : ''
      if (!question) return
      lines.push(`Q：${question}`, `A：${answer || '（未回答）'}`, '')
    })

    const custom =
      payload && typeof payload.promptContent === 'string' ? payload.promptContent.trim() : ''
    const base = custom ? custom.slice(0, MAX_PROMPT_CHARS) : SYSTEM_PROMPT
    const systemPrompt = `${base}\n\n请输出 Markdown 格式的完整提示词（使用 ### 标题分节），可以直接粘贴使用。`

    return optimize(lines.join('\n'), signal, systemPrompt)
  }

  /**
   * Accepts `[{question, options:[...]}]`, plain strings, or a numbered list and
   * normalises everything to `{ question, options }` entries.
   */
  function parseQuestions(raw) {
    const text = String(raw || '').trim()
    if (!text) return []
    const fenced = text.replace(/^```[a-zA-Z]*\s*/m, '').replace(/```\s*$/m, '')
    const start = fenced.indexOf('[')
    const end = fenced.lastIndexOf(']')
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(fenced.slice(start, end + 1))
        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => {
              if (typeof item === 'string') return { question: item.trim(), options: [] }
              if (item && typeof item === 'object') {
                const question = typeof item.question === 'string' ? item.question.trim() : ''
                const options = Array.isArray(item.options)
                  ? item.options
                      .map((option) => (typeof option === 'string' ? option.trim() : ''))
                      .filter((option) => option.length > 0)
                      .slice(0, 4)
                  : []
                return { question, options }
              }
              return null
            })
            .filter((item) => item && item.question.length > 0)
            .slice(0, 6)
        }
      } catch {
        /* fall through to line parsing */
      }
    }
    return fenced
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.、)])\s*/, '').trim())
      .filter((line) => line.length > 0)
      .map((line) => ({ question: line, options: [] }))
      .slice(0, 6)
  }

  async function handle(endpoint, payload, signal) {
    try {
      if (endpoint === ENDPOINT) return await runOptimize(payload, signal)
      if (endpoint === 'clarify') return await runClarify(payload, signal)
      if (endpoint === 'finalize') return await runFinalize(payload, signal)
      return failure('unknown-endpoint', `Unknown endpoint "${String(endpoint)}".`)
    } catch (error) {
      return failure('internal-error', (error && error.message) || String(error))
    }
  }

  let fetchBound = false
  let rpcBound = false

  function bind() {
    const connection = ctx.get('connection')
    if (!connection) return false
    let bound = false
    try {
      if (!fetchBound && connection.fetch && typeof connection.fetch.register === 'function') {
        connection.fetch.register({
          path: ROUTE_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          async fetch(request) {
            let payload
            try {
              payload = await request.json()
            } catch {
              return jsonResponse(400, failure('bad-request', 'The request body is not valid JSON.'))
            }
            const endpoint =
              payload && typeof payload.endpoint === 'string' ? payload.endpoint : ENDPOINT
            const result = await handle(endpoint, payload, request.signal)
            return jsonResponse(result.ok ? 200 : 502, result)
          },
        })
        fetchBound = true
        bound = true
      }
    } catch {
      /* keep the RPC fallback available */
    }
    try {
      if (!rpcBound && connection.rpc && typeof connection.rpc.handle === 'function') {
        connection.rpc.handle(CHANNEL, handle)
        rpcBound = true
        bound = true
      }
    } catch {
      /* the Fetch route already covers the UI path */
    }
    return bound
  }

  bind()
  ctx.inject(['connection'], () => {
    bind()
  })
  ctx.effect(() => {
    let tries = 0
    const timer = setInterval(() => {
      tries += 1
      if (bind() || tries >= 40) clearInterval(timer)
    }, 250)
    return () => clearInterval(timer)
  })
}



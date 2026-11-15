/**
 * Client half of the composer prompt optimizer.
 *
 * Two surfaces:
 *  1. the round control in the composer (position, colour and icon configurable),
 *  2. the "鎻愮ず璇嶅姛鑳借缃? page under Settings, which edits that configuration.
 *
 * The configuration lives in localStorage so it survives reloads without a Host
 * round trip; the draft rewrite itself still goes through the Host model call.
 */
window.__ModuleLoader__.load({
  id: '@local/composer-prompt-optimizer',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const CHANNEL = '/composer-prompt-optimizer'
    const ROUTE = 'api/prompt-optimizer/optimize'

    const BUTTON_SIZE = 32
    const ICON_SIZE = 18
    const STORAGE_KEY = 'dsh:prompt-optimizer:config:v1'
    const MAX_PROMPT_CHARS = 8000

    const DEFAULT_COLOR = '#f97316'
    const DEFAULT_SHORTCUT = {
      enabled: true,
      ctrl: true,
      rightCtrl: true,
      shift: false,
      alt: false,
      meta: false,
      key: 'Enter',
    }
    const DEFAULT_PROMPT = [
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
      '草稿中确实缺失、又会影响效果的关键信息，在提示词末尾用一小段“待补充信息”列出。',
    ].join('\n')


    // Position presets: each maps to a real slot plus its registration options.
    const POSITIONS = {
      between: {
        slot: 'conversation.input.activity',
        registration: {},
      },
      beforeSend: {
        slot: 'conversation.input.right',
        registration: { id: 'prompt-optimizer', order: 20 },
      },
      floating: {
        slot: 'conversation.input.overlay',
        registration: { id: 'prompt-optimizer', order: 60 },
      },
    }

    const POSITION_LABELS = {
      zh: {
        between: '模型选择器与发送键之间',
        beforeSend: '发送键左侧（工具条内）',
        floating: '输入框右上角（浮动）',
      },
      en: {
        between: 'Between model selector and Send',
        beforeSend: 'Left of Send (tool row)',
        floating: 'Top-right corner (floating)',
      },
    }

    const ICON_IDS = ['bulb', 'wand', 'bolt', 'star', 'person']

    const ICON_LABELS = {
      zh: { bulb: '灯泡', wand: '魔杖', bolt: '闪电', star: '星星', person: '小人' },
      en: {
        bulb: 'Bulb',
        wand: 'Wand',
        bolt: 'Bolt',
        star: 'Star',
        person: 'Person',
      },
    }

    // Per-icon loading motion used when the loading style is "icon animation".
    const ICON_ANIMATION = {
      bulb: 'dsh-po-anim-bulb 1s ease-in-out infinite',
      wand: 'dsh-po-anim-wand 0.9s ease-in-out infinite',
      bolt: 'dsh-po-anim-bolt 0.8s ease-in-out infinite',
      star: 'dsh-po-anim-star 1.4s linear infinite',
      person: 'dsh-po-anim-person 0.8s ease-in-out infinite',
    }

    /** Per-icon transform origin for the loading animation; every icon now spins in place. */
    const ICON_TRANSFORM_ORIGIN = {}

    // Keyframes for the loading ring and every per-icon preset. Rendered inside
    // the component so they disappear with it.
    const SPIN_CSS = [
      '@keyframes dsh-po-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      '@keyframes dsh-po-breathe{0%,100%{opacity:.3}50%{opacity:1}}',
      // The breathing bar only fades: its glow swells and fades in place.
      '@keyframes dsh-po-breath-glow{0%,100%{opacity:.45}50%{opacity:1}}',
      '@keyframes dsh-po-anim-bulb{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.14);opacity:1}}',
      '@keyframes dsh-po-anim-wand{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}',
      '@keyframes dsh-po-anim-bolt{0%,100%{transform:translateY(0)}30%{transform:translateY(-2px)}60%{transform:translateY(1px)}}',
      '@keyframes dsh-po-anim-star{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}',
      '@keyframes dsh-po-anim-person{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}',
    ].join('')

    const TEXT = {
      en: {
        label: 'Optimize prompt',
        hint: 'Click to optimize!',
        busy: 'Optimizing…',
        empty: 'Type a draft first',
        failed: 'Optimization failed',
        noTransport: 'Not connected to the Host',
        noDraftApi: 'This composer cannot accept text yet',
        sectionTitle: 'Prompt feature settings',
        sectionIntro:
          'These settings only affect the prompt button next to the composer.',
        promptLabel: 'Prompt content',
        promptHint:
          'The instruction sent to the model. Leave empty to use the built-in default.',
        promptDefault: 'Fill in the default prompt',
        colorLabel: 'Colour',
        colorHint: 'Background colour of the button.',
        iconLabel: 'Icon',
        iconHint: 'Icon drawn inside the button.',
        positionLabel: 'Button position',
        positionHint: 'Where the button sits relative to the composer.',
        languageLabel: 'Language',
        languageHint: "Display language of this plugin's page and tooltip.",
        languageAuto: 'Follow app',
        fileLabel: 'Also save as a .md file',
        fileHint:
          'Off by default: the result goes straight into the composer. When on, the same text is also downloaded as a Markdown file.',
        fileOn: 'On',
        fileOff: 'Off',
        loadingLabel: 'Loading animation',
        loadingHint:
          'What the button shows while the model works. The icon preset animates whichever icon is selected.',
        loadingRing: 'Rotating circle',
        loadingIcon: 'Icon preset',
        breathBarLabel: 'Bar beside the input box',
        breathBarHint:
          'A thin light line above or below the box while the optimiser works. It breathes in place and sits two thirds of a 汉字 away from the box, so it never covers the input or the buttons.',
        breathBarTop: 'Bar above the box',
        breathBarBottom: 'Bar below the box',
        breathBarOff: 'Off',
        previewLabel: 'Preview',
        shortcutLabel: 'Keyboard shortcut',
        shortcutHint: 'Trigger the optimizer without clicking. Default: Right Ctrl + Enter.',
        shortcutEnabled: 'Shortcut on',
        shortcutDisabled: 'Shortcut off',
        shortcutRecord: 'Record',
        shortcutRecording: 'Press keys…',
        shortcutReset: 'Default',
        shortcutPressAgain: 'Press a key combination…',
        modeLabel: 'Interaction mode',
        modeHint: 'What happens when you click the button.',
        modeDirect: 'Direct optimize',
        modeDirectHint: 'Rewrite the draft and type it straight into the composer.',
        modeInterview: 'Ask first',
        modeInterviewHint:
          'Ask a few questions (two to four) first, then type the finished prompt into the composer.',
        panelPrev: 'Previous question',
        panelNext: 'Next question',
        panelClose: 'Exit questions',
        panelHint: 'Pick an option, or answer in the composer below and press Enter.',
        panelSkip: 'Skip',
        panelGenerate: 'Generate prompt',
        panelNextStep: 'Next',
        panelRetry: 'Retry',
        reset: 'Restore defaults',
        storageNote:
          'Stored in this browser (localStorage). It does not sync across devices.',
        restored: 'Defaults restored.',
      },
      zh: {
        label: '优化提示词',
        hint: '点点优化！',
        busy: '正在优化…',
        empty: '请先输入草稿',
        failed: '优化失败',
        noTransport: '未连接到 Host',
        noDraftApi: '当前输入框暂不可写入',
        sectionTitle: '提示词功能设置',
        sectionIntro: '以下配置只影响输入框旁的提示词按钮。',
        promptLabel: '提示词内容',
        promptHint: '发给模型的指令。留空则使用内置默认提示词。',
        promptDefault: '填入默认提示词',
        colorLabel: '颜色',
        colorHint: '按钮的背景颜色。',
        iconLabel: '图标',
        iconHint: '按钮内显示的图标。',
        positionLabel: '按钮位置',
        positionHint: '按钮相对于输入框的位置。',
        languageLabel: '界面语言',
        languageHint: '这个插件的设置页与提示文字使用的语言。',
        languageAuto: '跟随应用',
        fileLabel: '同时生成 Markdown 文件',
        fileHint: '默认关闭：结果直接写回输入框。开启后，同样的内容会再下载成一份 .md 文件。',
        fileOn: '开启',
        fileOff: '关闭',
        loadingLabel: '加载动效',
        loadingHint: '模型工作时按钮显示什么。选「图标预设」会按当前图标播各自的预设动效。',
        loadingRing: '圆圈旋转',
        loadingIcon: '图标预设',
        breathBarLabel: '输入框条形呼吸灯',
        breathBarHint:
          '优化进行中在输入框上方或下方亮一条细光带。整条光带原地呼吸明暗，与输入框相距固定 2/3 个汉字高度，不会遮挡输入内容与按钮。',
        breathBarTop: '上侧呼吸灯',
        breathBarBottom: '下侧呼吸灯',
        breathBarOff: '关闭',
        previewLabel: '预览',
        shortcutLabel: '快捷键',
        shortcutHint: '不用点按钮，直接按键触发优化。默认：右 Ctrl + Enter。',
        shortcutEnabled: '快捷键开',
        shortcutDisabled: '快捷键关',
        shortcutRecord: '录制',
        shortcutRecording: '请按键…',
        shortcutReset: '恢复默认',
        shortcutPressAgain: '请按组合键…',
        modeLabel: '主要交互方式',
        modeHint: '点击按钮后发生什么。',
        modeDirect: '默认优化',
        modeDirectHint: '直接改写草稿，逐字写回输入框。',
        modeInterview: '提问优化',
        modeInterviewHint: '先问 2~4 个问题，再把成品提示词逐字写回输入框。',
        panelPrev: '上一题',
        panelNext: '下一题',
        panelClose: '退出提问',
        panelHint: '点选一个选项，或直接在下方输入框作答后按 Enter。',
        panelSkip: '跳过',
        panelGenerate: '生成提示词',
        panelNextStep: '下一个',
        panelRetry: '重试',
        reset: '恢复默认',
        storageNote: '保存在当前浏览器（localStorage），不会跨设备同步。',
        restored: '已恢复默认。',
      },
    }


    function currentLanguage(ctx) {
      try {
        const locale = ctx.get('locale')
        if (!locale) return 'en'
        const snapshot =
          typeof locale.getLocale === 'function'
            ? locale.getLocale()
            : typeof locale.getSnapshot === 'function'
              ? locale.getSnapshot()
              : undefined
        const id = snapshot && (snapshot.id || snapshot.locale || snapshot.language)
        return typeof id === 'string' && id.toLowerCase().indexOf('zh') === 0 ? 'zh' : 'en'
      } catch {
        return 'en'
      }
    }

    /** The plugin's own language setting wins; `auto` follows the app locale. */
    function resolveLanguage(ctx, config) {
      const chosen = config && config.language
      if (chosen === 'zh' || chosen === 'en') return chosen
      return currentLanguage(ctx)
    }

    // ---------------------------------------------------------------- config

    const listeners = new Set()
    let current = null

    function normalize(raw) {
      const source = raw && typeof raw === 'object' ? raw : {}
      const color = typeof source.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(source.color)
        ? source.color.toLowerCase()
        : DEFAULT_COLOR
      const icon = ICON_IDS.indexOf(source.icon) >= 0 ? source.icon : 'bulb'
      const position = Object.prototype.hasOwnProperty.call(POSITIONS, source.buttonPosition)
        ? source.buttonPosition
        : 'between'
      const promptContent =
        typeof source.promptContent === 'string'
          ? source.promptContent.slice(0, MAX_PROMPT_CHARS)
          : DEFAULT_PROMPT
      const language =
        source.language === 'zh' || source.language === 'en' || source.language === 'auto'
          ? source.language
          : 'zh'
      const outputMarkdownFile = source.outputMarkdownFile === true
      const loadingStyle = source.loadingStyle === 'icon' ? 'icon' : 'ring'
      // One choice: top / bottom / off. The old split settings (style / position /
      // gap) are migrated here so a saved solid bar keeps its colour position.
      const breathBar = normalizeBreathBar(source)
      const interactionMode = source.interactionMode === 'interview' ? 'interview' : 'direct'
      const rawShortcut = source.shortcut && typeof source.shortcut === 'object' ? source.shortcut : {}
      const shortcut = {
        enabled: rawShortcut.enabled !== false,
        ctrl: rawShortcut.ctrl === true,
        rightCtrl: rawShortcut.rightCtrl !== false,
        shift: rawShortcut.shift === true,
        alt: rawShortcut.alt === true,
        meta: rawShortcut.meta === true,
        key: typeof rawShortcut.key === 'string' && rawShortcut.key.length > 0
          ? rawShortcut.key
          : DEFAULT_SHORTCUT.key,
      }
      return {
        promptContent,
        color,
        icon,
        buttonPosition: position,
        language,
        outputMarkdownFile,
        loadingStyle,
        breathBar,
        interactionMode,
        shortcut,
      }
    }

    function loadConfig() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return normalize({ promptContent: DEFAULT_PROMPT })
        return normalize(JSON.parse(raw))
      } catch {
        return normalize({ promptContent: DEFAULT_PROMPT })
      }
    }

    function getConfig() {
      if (!current) current = loadConfig()
      return current
    }
    // Runtime mirrors shared by the module-level listeners.
    let runShortcut = null
    let rightCtrlDown = false
    let shortcutSuspended = false
    /** Latest composer text, mirrored for the Enter handler. */
    let latestDraft = ''

    // "Optimizer is working" flag, consumed by the composer glow.
    const runningListeners = new Set()
    let runningNow = false

    function setRunning(value) {
      if (runningNow === value) return
      runningNow = value
      runningListeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
    }

    function useRunning() {
      const [value, setValue] = React.useState(runningNow)
      React.useEffect(() => {
        const notify = () => setValue(runningNow)
        runningListeners.add(notify)
        return () => runningListeners.delete(notify)
      }, [])
      return value
    }

    /** Types the result into the composer so the text lands progressively. */
    async function writeProgressive(actions, fullText) {
      const total = fullText.length
      if (!total) return
      const step = Math.max(1, Math.ceil(total / 160))
      let index = 0
      while (index < total) {
        index = Math.min(total, index + step)
        try {
          actions.setDraft(fullText.slice(0, index))
        } catch {
          return
        }
        await new Promise((resolve) => setTimeout(resolve, 18))
      }
    }


    function setConfig(patch) {
      current = normalize({ ...getConfig(), ...patch })
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
      } catch {
        /* storage unavailable: keep the in-memory value */
      }
      listeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
      return current
    }

    function subscribe(fn) {
      listeners.add(fn)
      return () => listeners.delete(fn)
    }

    function useConfig() {
      const [snapshot, setSnapshot] = React.useState(getConfig())
      React.useEffect(() => subscribe(() => setSnapshot(getConfig())), [])
      return snapshot
    }

    /** Optional side output: hand the same text to the browser as a .md file. */
    function downloadMarkdown(text) {
      try {
        const stamp = new Date()
          .toISOString()
          .replace(/[-:]/g, '')
          .replace('T', '-')
          .slice(0, 15)
        const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `prompt-${stamp}.md`
        anchor.style.display = 'none'
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setTimeout(() => {
          try {
            URL.revokeObjectURL(url)
          } catch {
            /* ignore */
          }
        }, 1500)
      } catch {
        /* a blocked download must not break the text result */
      }
    }


    // ------------------------------------------------------- interview state
    //
    // One question at a time, answered in the composer itself: the panel above
    // the composer shows the current question with three clickable options, the
    // user picks one or types the answer in the input box, Enter advances.

    const dialogState = {
      open: false,
      status: 'idle',
      text: '',
      questions: [],
      answers: [],
      index: 0,
      error: '',
      write: null,
      sessionId: null,
    }
    const dialogListeners = new Set()
    let dialogAbort = null

    function setDialog(patch) {
      Object.assign(dialogState, patch)
      dialogListeners.forEach((fn) => {
        try {
          fn()
        } catch {
          /* ignore */
        }
      })
    }

    function useDialogState() {
      const [snapshot, setSnapshot] = React.useState(dialogState)
      React.useEffect(() => {
        const notify = () => setSnapshot({ ...dialogState })
        dialogListeners.add(notify)
        return () => dialogListeners.delete(notify)
      }, [])
      return snapshot
    }

    function resetDialog() {
      if (dialogAbort) {
        try {
          dialogAbort.abort()
        } catch {
          /* ignore */
        }
        dialogAbort = null
      }
      setRunning(false)
      setDialog({
        open: false,
        status: 'idle',
        text: '',
        questions: [],
        answers: [],
        index: 0,
        error: '',
        write: null,
        sessionId: null,
      })
    }

    function cancelInterview() {
      const write = dialogState.write
      const original = dialogState.text
      resetDialog()
      if (typeof write === 'function' && original) {
        try {
          write(original)
        } catch {
          /* ignore */
        }
      }
    }

    async function startInterview(ctx, draft, write, sessionId) {
      if (dialogAbort) {
        try {
          dialogAbort.abort()
        } catch {
          /* ignore */
        }
      }
      const controller = new AbortController()
      dialogAbort = controller
      setRunning(true)
      setDialog({
        open: true,
        status: 'loading',
        text: draft,
        questions: [],
        answers: [],
        index: 0,
        error: '',
        write,
        sessionId: sessionId || null,
      })
      try {
        write('')
      } catch {
        /* the composer stays as-is if the write is refused */
      }
      try {
        const result = await requestApi(ctx, 'clarify', { text: draft }, controller.signal)
        if (controller.signal.aborted) return
        if (
          result &&
          result.ok === true &&
          result.value &&
          Array.isArray(result.value.questions) &&
          result.value.questions.length > 0
        ) {
          const questions = result.value.questions.slice(0, 6)
          setDialog({
            status: 'ready',
            questions,
            answers: questions.map(() => ''),
            index: 0,
          })
        } else {
          setRunning(false)
          setDialog({
            status: 'error',
            error: (result && result.error && result.error.message) || '未能生成问题，请重试。',
          })
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setRunning(false)
          setDialog({ status: 'error', error: (failure && failure.message) || '出错了。' })
        }
      }
    }

    async function answerCurrent(ctx, config, answer) {
      if (dialogState.status !== 'ready') return
      const answers = dialogState.answers.slice()
      answers[dialogState.index] = String(answer || '').trim()
      const next = dialogState.index + 1
      if (next < dialogState.questions.length) {
        setDialog({ answers, index: next })
        try {
          if (typeof dialogState.write === 'function') dialogState.write(answers[next] || '')
        } catch {
          /* ignore */
        }
        return
      }
      setDialog({ answers, index: next })
      await finalizeInterview(ctx, config, answers)
    }

    function goToQuestion(target, currentDraft) {
      if (dialogState.status !== 'ready') return
      const total = dialogState.questions.length
      const answers = dialogState.answers.slice()
      answers[dialogState.index] = String(currentDraft || '').trim()
      const clamped = Math.max(0, Math.min(total - 1, target))
      setDialog({ answers, index: clamped })
      try {
        if (typeof dialogState.write === 'function') dialogState.write(answers[clamped] || '')
      } catch {
        /* ignore */
      }
    }

    async function finalizeInterview(ctx, config, answers) {
      const questions = dialogState.questions
      const controller = new AbortController()
      dialogAbort = controller
      setDialog({ status: 'generating', error: '' })
      setRunning(true)
      try {
        const result = await requestApi(
          ctx,
          'finalize',
          {
            text: dialogState.text,
            answers: questions.map((question, index) => ({
              question: (question && question.question) || '',
              answer: (answers[index] || '').trim(),
            })),
            promptContent: config.promptContent,
          },
          controller.signal,
        )
        if (controller.signal.aborted) return
        if (result && result.ok === true && result.value && typeof result.value.text === 'string') {
          const finalText = result.value.text
          if (config.outputMarkdownFile) downloadMarkdown(finalText)
          const write = dialogState.write
          resetDialog()
          if (typeof write === 'function') {
            await writeProgressive({ setDraft: write }, finalText)
          }
        } else {
          setDialog({
            status: 'error',
            error: (result && result.error && result.error.message) || '生成失败，请重试。',
          })
        }
      } catch (failure) {
        if (!controller.signal.aborted) {
          setDialog({ status: 'error', error: (failure && failure.message) || '出错了。' })
        }
      } finally {
        setRunning(false)
      }
    }

    /**
     * Interview panel: docks above the composer, one question at a time with
     * three clickable options, and the answer typed in the composer itself.
     */
    function InterviewPanel(props) {
      const ctx = props.ctx
      const config = useConfig()
      const state = useDialogState()
      const language = resolveLanguage(ctx, config)
      const text = TEXT[language]

      const useInput = props.useInput
      const draft = useInput ? useInput((snapshot) => snapshot.draft) : ''
      const draftText = typeof draft === 'string' ? draft : ''
      latestDraft = draftText

      // Hidden while questions are still being prepared, and scoped to the
      // Session it was started from: switching away hides it, switching back
      // brings it back.
      if (!state.open || state.status === 'loading') return null
      if (state.sessionId && props.sessionId && props.sessionId !== state.sessionId) return null

      const total = state.questions.length
      const index = state.index
      const current = state.questions[index] || null
      const question = current && typeof current.question === 'string' ? current.question : ''
      const options = current && Array.isArray(current.options) ? current.options : []
      const isLast = index === total - 1
      const busy = state.status === 'generating'

      const retry = () => {
        if (state.questions.length > 0) {
          finalizeInterview(ctx, config, state.answers)
        } else {
          startInterview(ctx, state.text, state.write, state.sessionId)
        }
      }

      const navStyle = (enabled) => ({
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 24,
        height: 24,
        padding: 0,
        borderRadius: 6,
        border: 'none',
        background: 'transparent',
        color: enabled ? 'var(--dsw-alias-label-primary)' : 'var(--dsw-alias-label-secondary)',
        opacity: enabled ? 1 : 0.4,
        cursor: enabled ? 'pointer' : 'default',
        fontSize: 14,
        lineHeight: 1,
      })

      return h(
        'div',
        {
          style: {
            boxSizing: 'border-box',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
            marginBottom: 8,
          },
        },
        h(
          'div',
          {
            style: {
              boxSizing: 'border-box',
              width: '100%',
              maxWidth: '100%',
              minWidth: 0,
              padding: 'clamp(8px, 2.5vw, 12px) clamp(10px, 3vw, 14px)',
              borderRadius: 14,
              border: '1px solid var(--dsw-alias-border-l1)',
              background: 'var(--dsw-alias-bg-layer-1)',
              color: 'var(--dsw-alias-label-primary)',
              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.06)',
            },
          },
          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap',
              },
            },
            h(
              'div',
              {
                style: {
                  fontSize: 14,
                  fontWeight: 600,
                  lineHeight: 1.5,
                  flex: '1 1 auto',
                  minWidth: 0,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                },
              },
              question,
            ),
            h(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 2, flex: '0 0 auto' } },
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': text.panelPrev,
                  disabled: index <= 0 || busy,
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => goToQuestion(index - 1, draftText),
                  style: navStyle(index > 0 && !busy),
                },
                '\u2039',
              ),
              h(
                'span',
                {
                  style: {
                    fontSize: 12,
                    minWidth: 44,
                    textAlign: 'center',
                    color: 'var(--dsw-alias-label-secondary)',
                  },
                },
                `${Math.min(index + 1, total)} / ${total}`,
              ),
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': text.panelNext,
                  disabled: isLast || busy,
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => goToQuestion(index + 1, draftText),
                  style: navStyle(!isLast && !busy),
                },
                '\u203a',
              ),
              h(
                'button',
                {
                  type: 'button',
                  'aria-label': text.panelClose,
                  onMouseDown: (event) => event.preventDefault(),
                  onClick: () => cancelInterview(),
                  style: { ...navStyle(true), marginLeft: 6, fontSize: 16 },
                },
                '\u00d7',
              ),
            ),
          ),

          state.status === 'ready'
            ? h(
                'div',
                {
                  style: {
                    marginTop: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  },
                },
                options.map((option, position) =>
                  h(
                    'button',
                    {
                      key: position,
                      type: 'button',
                      onMouseDown: (event) => event.preventDefault(),
                      onClick: () => answerCurrent(ctx, config, option),
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        width: '100%',
                        maxWidth: '100%',
                        minWidth: 0,
                        boxSizing: 'border-box',
                        textAlign: 'left',
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: '1px solid var(--dsw-alias-border-l1)',
                        background: 'transparent',
                        color: 'var(--dsw-alias-label-primary)',
                        fontSize: 13,
                        lineHeight: 1.5,
                        cursor: 'pointer',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      },
                    },
                    h(
                      'span',
                      {
                        style: {
                          width: 14,
                          flex: '0 0 auto',
                          color: 'var(--dsw-alias-label-secondary)',
                          fontSize: 12,
                        },
                      },
                      String(position + 1),
                    ),
                    h('span', { style: { flex: '1 1 auto', minWidth: 0 } }, option),
                  ),
                ),
              )
            : null,

          state.status === 'generating'
            ? h(
                'div',
                {
                  style: {
                    fontSize: 13,
                    marginTop: 8,
                    color: 'var(--dsw-alias-label-secondary)',
                  },
                },
                text.busy,
              )
            : null,

          state.error
            ? h(
                'div',
                {
                  style: {
                    fontSize: 12,
                    color: 'var(--dsw-alias-state-error-primary)',
                    marginTop: 6,
                  },
                },
                state.error,
              )
            : null,

          h(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: 10,
                flexWrap: 'wrap',
              },
            },
            h(
              'span',
              { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              state.status === 'ready' ? text.panelHint : '',
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 8 } },
              state.status === 'error'
                ? h(
                    'button',
                    { type: 'button', onClick: retry, style: optionStyle(false) },
                    text.panelRetry,
                  )
                : null,
              state.status === 'ready'
                ? h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => answerCurrent(ctx, config, ''),
                      style: optionStyle(false),
                    },
                    text.panelSkip,
                  )
                : null,
              state.status === 'ready'
                ? h(
                    'button',
                    {
                      type: 'button',
                      onClick: () => answerCurrent(ctx, config, draftText),
                      style: {
                        ...optionStyle(true),
                        background: 'var(--dsw-alias-brand-primary)',
                        color: '#ffffff',
                        borderColor: 'var(--dsw-alias-brand-primary)',
                        cursor: 'pointer',
                      },
                    },
                    isLast ? text.panelGenerate : text.panelNextStep,
                  )
                : null,
            ),
          ),
        ),
      )
    }


    // ----------------------------------------------------------------- icons

    function BulbIcon() {
      return h(
        'svg',
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          viewBox: '0 0 18 18',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M9 2.1a4.7 4.7 0 0 0-2.8 8.5c.5.4.8 1 .8 1.6v.5h4v-.5c0-.6.3-1.2.8-1.6A4.7 4.7 0 0 0 9 2.1Z',
        }),
        h('path', { d: 'M7.5 15.1h3' }),
        h('path', { d: 'M8.2 16.5h1.6' }),
        h('path', {
          d: 'M9.6 5.1 7.2 8.6h1.7l-.6 2.7 2.5-3.6H9.1 Z',
          fill: 'currentColor',
          stroke: 'none',
        }),
      )
    }

    function BoltIcon() {
      return h(
        'svg',
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          viewBox: '0 0 18 18',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M10.4 1.8 4.6 10h3.6l-.6 6.2L13.4 8H9.8 Z',
          fill: 'currentColor',
          stroke: 'none',
        }),
      )
    }

    function StarIcon() {
      return h(
        'svg',
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          viewBox: '0 0 18 18',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.4,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', {
          d: 'M9 1.9 11.1 6.6 16.2 7.2 12.4 10.7 13.4 15.7 9 13.1 4.6 15.7 5.6 10.7 1.8 7.2 6.9 6.6 Z',
          fill: 'currentColor',
          stroke: 'none',
        }),
      )
    }

    function WandIcon() {
      return h(
        'svg',
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          viewBox: '0 0 18 18',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('path', { d: 'M2.6 15.4 10.4 7.6' }),
        h('path', {
          d: 'M12.6 2.2 13.6 4.9 16.3 5.9 13.6 6.9 12.6 9.6 11.6 6.9 8.9 5.9 11.6 4.9 Z',
          fill: 'currentColor',
          stroke: 'none',
        }),
      )
    }

    function PersonIcon() {
      return h(
        'svg',
        {
          width: ICON_SIZE,
          height: ICON_SIZE,
          viewBox: '0 0 18 18',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.5,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': true,
          focusable: false,
          style: { display: 'block' },
        },
        h('circle', { cx: 9, cy: 6.2, r: 2.7 }),
        h('path', { d: 'M3.8 15.4c0-2.9 2.3-4.7 5.2-4.7s5.2 1.8 5.2 4.7' }),
      )
    }

    const ICON_COMPONENTS = {
      bulb: BulbIcon,
      wand: WandIcon,
      bolt: BoltIcon,
      star: StarIcon,
      person: PersonIcon,
    }

    function LoadingRing() {
      return h('span', {
        'aria-hidden': true,
        style: {
          display: 'block',
          boxSizing: 'border-box',
          width: 16,
          height: 16,
          borderRadius: '50%',
          border: '2px solid rgba(255, 255, 255, 0.35)',
          borderTopColor: '#ffffff',
          animation: 'dsh-po-spin 0.85s linear infinite',
          transformOrigin: 'center center',
          willChange: 'transform',
        },
      })
    }

    /** Human-readable label for the stored shortcut, e.g. "R-Ctrl + Enter". */
    function formatShortcut(shortcut) {
      const s = shortcut || DEFAULT_SHORTCUT
      const parts = []
      if (s.ctrl) parts.push(s.rightCtrl ? 'R-Ctrl' : 'Ctrl')
      if (s.meta) parts.push('⌘')
      if (s.alt) parts.push('Alt')
      if (s.shift) parts.push('Shift')
      const key =
        s.key === 'Enter'
          ? 'Enter'
          : String(s.key || '')
              .replace(/^Key/, '')
              .replace(/^Digit/, '')
      parts.push(key)
      return parts.join(' + ')
    }

    function shade(color, amount) {
      const hex = color.replace('#', '')
      const num = parseInt(hex, 16)
      const r = Math.min(255, Math.max(0, ((num >> 16) & 255) + amount))
      const g = Math.min(255, Math.max(0, ((num >> 8) & 255) + amount))
      const b = Math.min(255, Math.max(0, (num & 255) + amount))
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
    }

    // ------------------------------------------------------------- transport

    async function requestApi(ctx, endpoint, payload, signal) {
      let primaryMessage = ''
      try {
        const response = await fetch(ROUTE, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ endpoint, ...payload }),
          signal,
          credentials: 'same-origin',
        })
        const data = await response.json().catch(() => undefined)
        if (data && typeof data === 'object' && typeof data.ok === 'boolean') return data
        primaryMessage = `api HTTP ${response.status}`
      } catch (primary) {
        if (signal && signal.aborted) throw primary
        primaryMessage = `api ${(primary && primary.message) || 'failed'}`
      }
      const connection = ctx.get('connection')
      if (!connection || !connection.rpc || typeof connection.rpc.call !== 'function') {
        throw new Error(primaryMessage)
      }
      try {
        return await connection.rpc.call(CHANNEL, endpoint, payload, signal)
      } catch (fallback) {
        if (signal && signal.aborted) throw fallback
        throw new Error(`${primaryMessage}; rpc ${(fallback && fallback.message) || 'failed'}`)
      }
    }

    // ------------------------------------------------------- composer button

    function OptimizeButton(props) {
      const ctx = props.ctx
      const actions = props.inputActions
      const useInput = props.useInput

      const config = useConfig()
      const draft = useInput((state) => state.draft)
      const phase = useInput((state) => state.phase)

      const [busy, setBusy] = React.useState(false)
      const interview = useDialogState()
      const interviewActive = interview.open && interview.status !== 'error'
      const [pulse, setPulse] = React.useState(false)
      const [error, setError] = React.useState('')
      const [hover, setHover] = React.useState(false)
      const [focused, setFocused] = React.useState(false)
      const [, bumpLocale] = React.useState(0)
      const abortRef = React.useRef(null)

      // The button animates during the model call and the write-back.
      const animating = busy || interviewActive
      const text = TEXT[resolveLanguage(ctx, config)]

      React.useEffect(() => {
        const locale = ctx.get('locale')
        if (!locale || typeof locale.subscribe !== 'function') return undefined
        let off
        try {
          off = locale.subscribe(() => bumpLocale((n) => n + 1))
        } catch {
          return undefined
        }
        return () => {
          try {
            if (typeof off === 'function') off()
          } catch {
            /* ignore */
          }
        }
      }, [ctx])

      React.useEffect(
        () => () => {
          if (abortRef.current) abortRef.current.abort()
        },
        [],
      )

      React.useEffect(() => {
        if (!animating || config.loadingStyle !== 'ring') {
          setPulse(false)
          return undefined
        }
        const timer = setInterval(() => setPulse((value) => !value), 550)
        return () => clearInterval(timer)
      }, [animating, config.loadingStyle])

      React.useEffect(() => {
        if (!error) return undefined
        const timer = setTimeout(() => setError(''), 8000)
        return () => clearTimeout(timer)
      }, [error])

      const draftText = typeof draft === 'string' ? draft : ''
      const empty = draftText.trim() === ''
      const machineBusy = phase === 'adjudicating' || phase === 'submitting'
      const disabled = busy || interviewActive || empty || machineBusy

      const run = async () => {
        if (busy) return
        if (draftText.trim() === '') {
          setError(text.empty)
          return
        }
        if (config.interactionMode === 'interview') {
          if (!actions || typeof actions.setDraft !== 'function') {
            setError(text.noDraftApi)
            return
          }
          startInterview(ctx, draftText, actions.setDraft, props.sessionId)
          return
        }
        if (abortRef.current) abortRef.current.abort()
        const controller = new AbortController()
        abortRef.current = controller
        setBusy(true)
        setRunning(true)
        setError('')
        try {
          const result = await requestApi(
            ctx,
            'optimize',
            { text: draftText, promptContent: config.promptContent },
            controller.signal,
          )
          if (result && result.ok === true && result.value && typeof result.value.text === 'string') {
            const finalText = result.value.text
            if (config.outputMarkdownFile) downloadMarkdown(finalText)
            if (actions && typeof actions.setDraft === 'function') {
              await writeProgressive(actions, finalText)
            } else {
              setError(text.noDraftApi)
            }
          } else if (result && result.ok === false) {
            setError((result.error && result.error.message) || text.failed)
          } else {
            setError(text.failed)
          }
        } catch (failure) {
          if (!controller.signal.aborted) {
            setError((failure && failure.message) || text.failed)
          }
        } finally {
          setRunning(false)
          if (abortRef.current === controller) {
            abortRef.current = null
            setBusy(false)
          }
        }
      }

      runShortcut = run

      const base = config.color
      const hoverColor = shade(base, 24)
      const pulseColor = shade(base, 70)
      const title = animating ? text.busy : empty ? text.empty : text.hint
      const background = animating
        ? pulse
          ? pulseColor
          : base
        : hover && !disabled
          ? hoverColor
          : base
      const IconComponent = ICON_COMPONENTS[config.icon] || BulbIcon

      const button = h(
        'button',
        {
          type: 'button',
          'aria-label': text.label,
          'aria-busy': animating ? 'true' : 'false',
          disabled,
          onMouseDown: (event) => event.preventDefault(),
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onClick: run,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            minWidth: BUTTON_SIZE,
            minHeight: BUTTON_SIZE,
            padding: 0,
            margin: 0,
            border: 'none',
            borderRadius: '50%',
            background,
            color: '#ffffff',
            cursor: disabled && !animating ? 'default' : 'pointer',
            opacity: disabled && !animating ? 0.55 : 1,
            boxShadow: `0 2px 8px ${base}59`,
            transition: 'background-color 220ms ease, opacity 120ms ease',
            lineHeight: 0,
            flex: '0 0 auto',
            alignSelf: 'center',
            verticalAlign: 'middle',
            overflow: 'visible',
          },
        },
        animating
          ? config.loadingStyle === 'icon'
            ? h(
                'span',
                {
                  style: {
                    display: 'inline-flex',
                    animation: ICON_ANIMATION[config.icon] || ICON_ANIMATION.bulb,
                  transformOrigin: ICON_TRANSFORM_ORIGIN[config.icon] || 'center',
                  },
                },
                h(IconComponent),
              )
            : h(LoadingRing)
          : h(IconComponent),
      )

      const errorNode = error
        ? h(
            'span',
            {
              role: 'status',
              style: {
                position: 'absolute',
                bottom: 'calc(100% + 6px)',
                right: 0,
                maxWidth: 240,
                padding: '5px 9px',
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-overlay)',
                color: 'var(--dsw-alias-state-error-primary)',
                fontSize: 12,
                lineHeight: 1.4,
                whiteSpace: 'normal',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.16)',
                pointerEvents: 'none',
                zIndex: 5,
              },
            },
            error,
          )
        : null

      // Black tooltip, white text, centred directly above the button.
      const tooltipNode =
        !error && (hover || focused)
          ? h(
              'span',
              {
                role: 'tooltip',
                style: {
                  position: 'absolute',
                  bottom: 'calc(100% + 8px)',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '4px 9px',
                  borderRadius: 6,
                  background: '#000000',
                  color: '#ffffff',
                  fontSize: 12,
                  lineHeight: 1.4,
                  whiteSpace: 'nowrap',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.28)',
                  pointerEvents: 'none',
                  zIndex: 6,
                },
              },
              title,
            )
          : null

      const floating = config.buttonPosition === 'floating'

      return h(
        'span',
        {
          style: {
            position: floating ? 'absolute' : 'relative',
            top: floating ? 10 : undefined,
            right: floating ? 14 : undefined,
            zIndex: floating ? 4 : undefined,
            display: 'inline-flex',
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            flex: '0 0 auto',
            alignItems: 'center',
            justifyContent: 'center',
            alignSelf: 'center',
            pointerEvents: floating ? 'auto' : undefined,
          },
        },
        h('style', null, SPIN_CSS),
        tooltipNode,
        errorNode,
        button,
      )
    }

    // ---------------------------------------------- breathing bar at the box
    //
    // The composer renders overlays inside an anchor pinned to the card's top
    // edge (height 0), so anything drawn here needs real card geometry. The bar
    // therefore measures the live card (own ref + ResizeObserver + per-frame
    // follow) and floats a thin glowing line *outside* the box: above it or
    // below it, centred, with a gap of one to three 汉字 heights. It lives in the
    // room both neighbours already reserve — the composer stack's gap above and
    // the dock row underneath — so it never covers input, tool buttons or the
    // context meter.

    /** Fallback for the host compositor's card row gap. */
    const CARD_GAP = 12
    /** Fallback content font size when the card does not expose its own. */
    const CARD_FONT_FALLBACK = 14
    /**
     * Breathing-bar geometry in 汉字 heights (the card's own font size). The
     * distance is fixed at two thirds of a 汉字 — it is no longer a setting.
     */
    const BAR_GAP_EM = 2 / 3

    /**
     * The bar is a single three-way choice: `top`, `bottom` or `off`. Older
     * builds stored three separate keys (style / position / gap); read those so
     * an existing configuration lands on the closest surviving option.
     */
    function normalizeBreathBar(source) {
      if (source.breathBar === 'top' || source.breathBar === 'bottom' || source.breathBar === 'off') {
        return source.breathBar
      }
      if (source.breathBarStyle === 'off') return 'off'
      return source.breathBarPosition === 'top' ? 'top' : 'bottom'
    }

    /** Composer geometry, read off the live card. */
    function measureComposer(card, anchor) {
      const cardRect = card.getBoundingClientRect()
      const style = getComputedStyle(card)
      const innerWidth =
        cardRect.width - (parseFloat(style.paddingLeft) || 0) - (parseFloat(style.paddingRight) || 0)
      const canvas =
        anchor && anchor.parentElement ? anchor.parentElement.getBoundingClientRect() : cardRect
      return {
        // Bar coordinates are relative to the positioned ancestor that hosts
        // this component; widths are the card's content width.
        left: cardRect.left - canvas.left,
        top: cardRect.top - canvas.top,
        width: Math.max(0, innerWidth),
        height: cardRect.height,
        // 1 汉字 == the card's content font size (defaults to 14px on the composer).
        em: parseFloat(style.fontSize) || CARD_FONT_FALLBACK,
        gap: parseFloat(style.rowGap || style.gap) || CARD_GAP,
      }
    }

    function sameComposer(a, b) {
      if (!a || !b) return false
      return (
        a.left === b.left &&
        a.top === b.top &&
        a.width === b.width &&
        a.height === b.height &&
        a.em === b.em &&
        a.gap === b.gap
      )
    }

    /**
     * Keeps the bar glued to the card. Resizing the window moves the card without
     * resizing it, which a ResizeObserver alone never reports, so the run also
     * re-measures once per frame until it ends.
     */
    function followComposer(active, measure) {
      React.useEffect(() => {
        if (!active) return undefined
        let frame = 0
        const tick = () => {
          try {
            measure()
          } catch {
            /* the composer may have unmounted mid-frame */
          }
          frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
      }, [active, measure])
    }

    /**
     * Breathing bar beside the input box: a thin glowing line that sweeps back
     * and forth and brightens as it goes, `position` = "top" (above the box) or
     * "bottom" (below it).
     */
    function BreathBar() {
      const running = useRunning()
      const config = useConfig()
      const hostRef = React.useRef(null)
      const [card, setCard] = React.useState(null)

      const measure = React.useCallback(() => {
        const host = hostRef.current
        if (!host) return
        const anchor = host.parentElement
        const node = anchor ? anchor.closest('[data-composer-card]') : null
        if (!anchor || !node) return
        const next = measureComposer(node, anchor)
        setCard((previous) => (sameComposer(previous, next) ? previous : next))
      }, [])

      React.useEffect(() => {
        if (!running) return undefined
        const host = hostRef.current
        const anchor = host && host.parentElement
        const node = anchor ? anchor.closest('[data-composer-card]') : null
        measure()
        let observer = null
        if (typeof ResizeObserver === 'function' && anchor && node) {
          observer = new ResizeObserver(measure)
          observer.observe(node)
          observer.observe(anchor)
        }
        window.addEventListener('resize', measure)
        return () => {
          if (observer) observer.disconnect()
          window.removeEventListener('resize', measure)
        }
      }, [running, measure])

      followComposer(running, measure)

      if (!running || card === null || config.breathBar === 'off') {
        // An empty stub: it only marks the positioned ancestor so the bar can be
        // measured again on the next run, and it draws nothing.
        return h('div', { ref: hostRef, 'aria-hidden': true, style: { display: 'none' } })
      }

      const em = card.em
      const gapEm = BAR_GAP_EM
      const top = config.breathBar === 'top'
      const color = config.color
      // The bar stays inside the strip the layout already gives us: one card gap
      // above, one dock row below. Keeping the body at `gap` and letting only the
      // glow reach the strip's edge means it never touches the neighbouring rows.
      const gap = Math.min(gapEm * em, card.gap - 2)
      const above = card.gap
      const thickness = Math.max(2, Math.round(em * 0.22))

      // The strip sits outside the card and ignores the pointer entirely, so the
      // bar can never intercept a click meant for the composer.
      const wrapper = {
        position: 'absolute',
        left: card.left,
        top: top ? card.top - above : card.top + card.height,
        width: card.width,
        height: above,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 30,
      }
      // Distance from the wrapper's edge nearest the box: the bar body sits
      // `gap` away, its glow may reach the edge of the strip.
      const barTop = top ? above - gap - thickness : gap

      return h(
        'div',
        { ref: hostRef, 'aria-hidden': true, style: wrapper },
        h('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: barTop,
            height: thickness,
            borderRadius: thickness / 2,
            // A flat, even gradient: the whole bar brightens and dims together.
            // No travelling highlight, so there is no sideways "flow".
            background: `linear-gradient(90deg, ${color}00 0%, ${color} 50%, ${color}00 100%)`,
            boxShadow: `0 0 8px ${color}99`,
            animation: 'dsh-po-breath-glow 1.9s ease-in-out infinite',
          },
        }),
      )
    }

    function Entry(props) {
      if (!props || !props.inputActions || typeof props.useInput !== 'function') return null
      return h(OptimizeButton, props)
    }

    // -------------------------------------------------------- settings page

    function Field(props) {
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 22 } },
        h(
          'div',
          { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)' } },
          props.label,
        ),
        props.control,
        props.hint
          ? h(
              'div',
              { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              props.hint,
            )
          : null,
      )
    }

    const inputStyle = {
      boxSizing: 'border-box',
      width: '100%',
      padding: '7px 10px',
      borderRadius: 8,
      border: '1px solid var(--dsw-alias-border-l1)',
      background: 'var(--dsw-alias-bg-layer-2)',
      color: 'var(--dsw-alias-label-primary)',
      fontSize: 13,
      outline: 'none',
    }

    const optionStyle = (active) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 12px',
      borderRadius: 8,
      border: `1px solid ${active ? 'var(--dsw-alias-brand-primary)' : 'var(--dsw-alias-border-l1)'}`,
      background: active ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
      color: active
        ? 'var(--dsw-alias-label-primary)'
        : 'var(--dsw-alias-label-secondary)',
      cursor: 'pointer',
      fontSize: 13,
    })

    /**
     * Miniature of the composer with the breathing bar over (or under) it, so
     * the settings preview shows exactly where the light will sit.
     */
    function BarPreview(props) {
      const order = props.position === 'top' ? ['strip', 'card'] : ['card', 'strip']
      const base = props.color
      const top = props.position === 'top'
      const gapEm = BAR_GAP_EM
      const em = 9
      const gap = Math.round(gapEm * em)
      const thickness = 2
      const strip = Math.max(14, gap + 6)
      const bar = {
        position: 'absolute',
        left: 0,
        right: 0,
        height: thickness,
        borderRadius: thickness / 2,
        background: `linear-gradient(90deg, ${base}00 0%, ${base} 50%, ${base}00 100%)`,
        boxShadow: `0 0 6px ${base}99`,
        animation: 'dsh-po-breath-glow 1.9s ease-in-out infinite',
      }
      const cardNode = h(
        'div',
        {
          key: 'card',
          style: {
            position: 'relative',
            width: '100%',
            height: 34,
            borderRadius: 10,
            background: 'var(--dsw-specific-input-major, var(--dsw-alias-bg-layer-2))',
            boxShadow: 'var(--dsw-elevation-soft)',
          },
        },
        h('div', {
          style: {
            position: 'absolute',
            left: 10,
            top: 8,
            fontSize: 11,
            color: 'var(--dsw-alias-label-tertiary)',
          },
        }, '…'),
      )
      const stripNode = h(
        'div',
        {
          key: 'strip',
          style: {
            position: 'relative',
            height: strip,
            overflow: 'hidden',
            pointerEvents: 'none',
          },
        },
        h('div', {
          style: {
            ...bar,
            top: top ? strip - gap - thickness : gap,
          },
        }),
      )
      // Above the box the strip is drawn first, below it last; order only matters
      // for the stacking, not for the geometry.
      return h(
        'div',
        { 'aria-hidden': true, style: { position: 'relative', width: 168, flex: '0 0 auto' } },
        order.map((key) => (key === 'card' ? cardNode : stripNode)),
      )
    }

    /** Live preview of the configured loading animation, looping on its own. */
    function LoadingPreview(props) {
      const config = props.config
      const [pulse, setPulse] = React.useState(false)

      React.useEffect(() => {
        if (config.loadingStyle !== 'ring') {
          setPulse(false)
          return undefined
        }
        const timer = setInterval(() => setPulse((value) => !value), 550)
        return () => clearInterval(timer)
      }, [config.loadingStyle])

      const base = config.color
      const IconComponent = ICON_COMPONENTS[config.icon] || BulbIcon
      const background = config.loadingStyle === 'ring' ? (pulse ? shade(base, 70) : base) : base

      return h(
        'span',
        {
          'aria-hidden': true,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            background,
            color: '#ffffff',
            boxShadow: `0 2px 8px ${base}59`,
          },
        },
        config.loadingStyle === 'icon'
          ? h(
              'span',
              {
                style: {
                  display: 'inline-flex',
                  animation: ICON_ANIMATION[config.icon] || ICON_ANIMATION.bulb,
                  transformOrigin: ICON_TRANSFORM_ORIGIN[config.icon] || 'center',
                },
              },
              h(IconComponent),
            )
          : h(LoadingRing),
      )
    }

    function SettingsPage(props) {
      const ctx = props.ctx
      const config = useConfig()
      const [notice, setNotice] = React.useState('')
      const [recording, setRecording] = React.useState(false)
      const language = resolveLanguage(ctx, config)
      const text = TEXT[language]

      React.useEffect(() => {
        if (!notice) return undefined
        const timer = setTimeout(() => setNotice(''), 2500)
        return () => clearTimeout(timer)
      }, [notice])

      const update = (patch) => {
        setConfig(patch)
      }

      // Shortcut recorder: the next non-modifier key becomes the binding.
      React.useEffect(() => {
        if (!recording) return undefined
        shortcutSuspended = true
        let sawRightCtrl = false
        const modifierCodes = [
          'ControlLeft',
          'ControlRight',
          'ShiftLeft',
          'ShiftRight',
          'AltLeft',
          'AltRight',
          'MetaLeft',
          'MetaRight',
        ]
        const onKeyDown = (event) => {
          if (event.code === 'ControlRight') sawRightCtrl = true
          if (modifierCodes.indexOf(event.code) >= 0) return
          event.preventDefault()
          event.stopPropagation()
          update({
            shortcut: {
              enabled: true,
              ctrl: event.ctrlKey,
              rightCtrl: event.ctrlKey && sawRightCtrl,
              shift: event.shiftKey,
              alt: event.altKey,
              meta: event.metaKey,
              key: event.code,
            },
          })
          setRecording(false)
        }
        const onKeyUp = (event) => {
          if (event.code === 'ControlRight') sawRightCtrl = false
        }
        window.addEventListener('keydown', onKeyDown, true)
        window.addEventListener('keyup', onKeyUp, true)
        return () => {
          shortcutSuspended = false
          window.removeEventListener('keydown', onKeyDown, true)
          window.removeEventListener('keyup', onKeyUp, true)
        }
      }, [recording])

      const resetAll = () => {
        setConfig({
          promptContent: DEFAULT_PROMPT,
          color: DEFAULT_COLOR,
          icon: 'bulb',
          buttonPosition: 'between',
          language: 'zh',
          outputMarkdownFile: false,
          loadingStyle: 'ring',
        breathBar: 'bottom',
          interactionMode: 'direct',
          shortcut: { ...DEFAULT_SHORTCUT },
        })
        setNotice(text.restored)
      }

      const positions = Object.keys(POSITIONS)
      const labels = POSITION_LABELS[language]
      const iconLabels = ICON_LABELS[language]

      return h(
        'div',
        {
          style: {
            maxWidth: 680,
            padding: '4px 4px 32px',
            color: 'var(--dsw-alias-label-primary)',
          },
        },
        h(
          'div',
          { style: { fontSize: 16, fontWeight: 600, marginBottom: 6 } },
          text.sectionTitle,
        ),
        h(
          'div',
          {
            style: {
              fontSize: 12,
              color: 'var(--dsw-alias-label-secondary)',
              marginBottom: 22,
            },
          },
          text.sectionIntro,
        ),

        h(Field, {
          label: text.promptLabel,
          hint: text.promptHint,
          control: h(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
            h('textarea', {
              value: config.promptContent,
              rows: 9,
              spellCheck: false,
              onChange: (event) => update({ promptContent: event.target.value }),
              style: { ...inputStyle, resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit' },
            }),
            h(
              'div',
              { style: { display: 'flex', gap: 8 } },
              h(
                'button',
                {
                  type: 'button',
                  onClick: () => update({ promptContent: DEFAULT_PROMPT }),
                  style: optionStyle(false),
                },
                text.promptDefault,
              ),
              h(
                'span',
                {
                  style: {
                    alignSelf: 'center',
                    fontSize: 12,
                    color: 'var(--dsw-alias-label-secondary)',
                  },
                },
                `${config.promptContent.length} / ${MAX_PROMPT_CHARS}`,
              ),
            ),
          ),
        }),

        h(Field, {
          label: text.colorLabel,
          hint: text.colorHint,
          control: h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            h('input', {
              type: 'color',
              value: config.color,
              onChange: (event) => update({ color: event.target.value }),
              style: {
                width: 44,
                height: 32,
                padding: 2,
                borderRadius: 8,
                border: '1px solid var(--dsw-alias-border-l1)',
                background: 'var(--dsw-alias-bg-layer-2)',
                cursor: 'pointer',
              },
            }),
            h('input', {
              type: 'text',
              value: config.color,
              spellCheck: false,
              onChange: (event) => {
                const value = event.target.value.trim()
                if (/^#[0-9a-fA-F]{6}$/.test(value)) update({ color: value })
              },
              style: { ...inputStyle, width: 120 },
            }),
            ['#f97316', '#e11d48', '#2563eb', '#16a34a', '#7c3aed'].map((preset) =>
              h('button', {
                key: preset,
                type: 'button',
                title: preset,
                onClick: () => update({ color: preset }),
                style: {
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  border:
                    config.color === preset
                      ? '2px solid var(--dsw-alias-label-primary)'
                      : '1px solid var(--dsw-alias-border-l1)',
                  background: preset,
                  cursor: 'pointer',
                  padding: 0,
                },
              }),
            ),
          ),
        }),

        h(Field, {
          label: text.breathBarLabel,
          hint: text.breathBarHint,
          control: h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            [
              ['top', text.breathBarTop],
              ['bottom', text.breathBarBottom],
              ['off', text.breathBarOff],
            ].map((entry) =>
              h(
                'button',
                {
                  key: entry[0],
                  type: 'button',
                  'aria-pressed': config.breathBar === entry[0] ? 'true' : 'false',
                  onClick: () => update({ breathBar: entry[0] }),
                  style: optionStyle(config.breathBar === entry[0]),
                },
                entry[1],
              ),
            ),
          ),
        }),

        h(Field, {
          label: text.iconLabel,
          hint: text.iconHint,
          control: h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            ICON_IDS.map((id) => {
              const IconComponent = ICON_COMPONENTS[id]
              const iconLabel = iconLabels[id] || id
              return h(
                'button',
                {
                  key: id,
                  type: 'button',
                  title: iconLabel,
                  'aria-pressed': config.icon === id ? 'true' : 'false',
                  onClick: () => update({ icon: id }),
                  style: {
                    ...optionStyle(config.icon === id),
                    padding: '5px 10px',
                  },
                },
                h(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: config.color,
                      color: '#ffffff',
                    },
                  },
                  h(IconComponent),
                ),
                iconLabel,
              )
            }),
          ),
        }),

        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 } },
          h(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                flex: '1 1 auto',
                minWidth: 0,
              },
            },
            h(
              'div',
              {
                style: {
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--dsw-alias-label-primary)',
                },
              },
              text.loadingLabel,
            ),
            h(
              'div',
              { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
              [
                ['ring', text.loadingRing],
                ['icon', text.loadingIcon],
              ].map((entry) =>
                h(
                  'button',
                  {
                    key: entry[0],
                    type: 'button',
                    'aria-pressed': config.loadingStyle === entry[0] ? 'true' : 'false',
                    onClick: () => update({ loadingStyle: entry[0] }),
                    style: optionStyle(config.loadingStyle === entry[0]),
                  },
                  entry[1],
                ),
              ),
            ),
            h(
              'div',
              { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary)' } },
              text.loadingHint,
            ),
          ),
          h(
            'div',
            {
              style: {
                flex: '0 0 auto',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              },
            },
            h(
              'div',
              {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  minWidth: 56,
                  minHeight: 56,
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: '1px dashed var(--dsw-alias-border-l1)',
                  background: 'var(--dsw-alias-bg-layer-2)',
                },
              },
              h(LoadingPreview, { config }),
            ),
            h(
              'div',
              { style: { fontSize: 11, color: 'var(--dsw-alias-label-secondary)' } },
              text.previewLabel,
            ),
          ),
        ),

        h(Field, {
          label: text.positionLabel,
          hint: text.positionHint,
          control: h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            positions.map((position) =>
              h(
                'button',
                {
                  key: position,
                  type: 'button',
                  'aria-pressed': config.buttonPosition === position ? 'true' : 'false',
                  onClick: () => update({ buttonPosition: position }),
                  style: optionStyle(config.buttonPosition === position),
                },
                labels[position],
              ),
            ),
          ),
        }),

        h(Field, {
          label: text.modeLabel,
          hint:
            config.interactionMode === 'interview' ? text.modeInterviewHint : text.modeDirectHint,
          control: h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            [
              ['direct', text.modeDirect],
              ['interview', text.modeInterview],
            ].map((entry) =>
              h(
                'button',
                {
                  key: entry[0],
                  type: 'button',
                  'aria-pressed': config.interactionMode === entry[0] ? 'true' : 'false',
                  onClick: () => update({ interactionMode: entry[0] }),
                  style: optionStyle(config.interactionMode === entry[0]),
                },
                entry[1],
              ),
            ),
          ),
        }),

        h(Field, {
          label: text.fileLabel,
          hint: text.fileHint,
          control: h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            [
              [false, text.fileOff],
              [true, text.fileOn],
            ].map((entry) =>
              h(
                'button',
                {
                  key: String(entry[0]),
                  type: 'button',
                  'aria-pressed': config.outputMarkdownFile === entry[0] ? 'true' : 'false',
                  onClick: () => update({ outputMarkdownFile: entry[0] }),
                  style: optionStyle(config.outputMarkdownFile === entry[0]),
                },
                entry[1],
              ),
            ),
          ),
        }),

        h(Field, {
          label: text.shortcutLabel,
          hint: text.shortcutHint,
          control: h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' } },
            h(
              'button',
              {
                type: 'button',
                'aria-pressed': config.shortcut.enabled ? 'true' : 'false',
                onClick: () =>
                  update({
                    shortcut: {
                      ...config.shortcut,
                      enabled: !config.shortcut.enabled,
                    },
                  }),
                style: optionStyle(config.shortcut.enabled),
              },
              config.shortcut.enabled ? text.shortcutEnabled : text.shortcutDisabled,
            ),
            h(
              'span',
              {
                style: {
                  fontSize: 12,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  padding: '5px 9px',
                  borderRadius: 6,
                  border: '1px solid var(--dsw-alias-border-l1)',
                  background: 'var(--dsw-alias-bg-layer-2)',
                  color: config.shortcut.enabled
                    ? 'var(--dsw-alias-label-primary)'
                    : 'var(--dsw-alias-label-secondary)',
                },
              },
              recording ? text.shortcutRecording : formatShortcut(config.shortcut),
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => setRecording((value) => !value),
                style: optionStyle(recording),
              },
              recording ? text.shortcutPressAgain : text.shortcutRecord,
            ),
            h(
              'button',
              {
                type: 'button',
                onClick: () => update({ shortcut: { ...DEFAULT_SHORTCUT } }),
                style: optionStyle(false),
              },
              text.shortcutReset,
            ),
          ),
        }),

        h(Field, {
          label: text.languageLabel,
          hint: text.languageHint,
          control: h(
            'div',
            { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            [
              ['zh', '中文'],
              ['en', 'English'],
              ['auto', text.languageAuto],
            ].map((entry) =>
              h(
                'button',
                {
                  key: entry[0],
                  type: 'button',
                  'aria-pressed': config.language === entry[0] ? 'true' : 'false',
                  onClick: () => update({ language: entry[0] }),
                  style: optionStyle(config.language === entry[0]),
                },
                entry[1],
              ),
            ),
          ),
        }),

        h(
          'div',
          {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginTop: 4,
              paddingTop: 16,
              borderTop: '1px solid var(--dsw-alias-border-l1)',
            },
          },
          h(
            'button',
            { type: 'button', onClick: resetAll, style: optionStyle(false) },
            text.reset,
          ),
          notice
            ? h(
                'span',
                { style: { fontSize: 12, color: 'var(--dsw-alias-state-success-primary)' } },
                notice,
              )
            : null,
        ),
        h(
          'div',
          {
            style: {
              marginTop: 14,
              fontSize: 12,
              color: 'var(--dsw-alias-label-secondary)',
            },
          },
          text.storageNote,
        ),
      )
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        const Component = (props) => h(Entry, { ...props, ctx })
        const SettingsComponent = (props) => h(SettingsPage, { ...props, ctx })
        const RingComponent = () => h(BreathBar, { ctx })
        const DialogComponent = (props) => h(InterviewPanel, { ...props, ctx })

        let disposeButton = null
        let mountedPosition = null

        function mountButton(position) {
          if (mountedPosition === position) return
          if (typeof disposeButton === 'function') {
            try {
              disposeButton()
            } catch {
              /* ignore */
            }
            disposeButton = null
          }
          mountedPosition = position
          const preset = POSITIONS[position] || POSITIONS.between
          disposeButton = ctx.slots.inject(preset.slot, () =>
            ctx.slots.register({ name: preset.slot, ...preset.registration }, Component),
          )
        }

        mountButton(getConfig().buttonPosition)

        const offConfig = subscribe(() => mountButton(getConfig().buttonPosition))

        ctx.effect(() =>
          ctx.slots.inject('settings.section', () =>
            ctx.slots.register(
              {
                name: 'settings.section',
                id: 'prompt-optimizer',
                order: 40,
                label: () =>
                  resolveLanguage(ctx, getConfig()) === 'zh'
                    ? '提示词功能设置'
                    : 'Prompt feature settings',
              },
              SettingsComponent,
            ),
          ),
        )

        // Breathing bar beside the input box while it works: above it, below it,
        // or nothing at all.
        ctx.effect(() =>
          ctx.slots.inject('conversation.input.overlay', () =>
            ctx.slots.register(
              { name: 'conversation.input.overlay', id: 'prompt-optimizer-ring', order: 5 },
              RingComponent,
            ),
          ),
        )

        // Interview mode docks above the composer so the question sits next to
        // the very input box the user answers in.
        ctx.effect(() =>
          ctx.slots.inject('conversation.input.dock', () =>
            ctx.slots.register(
              { name: 'conversation.input.dock', id: 'prompt-optimizer-interview', order: 10 },
              DialogComponent,
            ),
          ),
        )

        // While answering, Enter advances instead of sending the message.
        ctx.effect(() => {
          const onKeyDown = (event) => {
            if (event.key !== 'Enter' || event.isComposing) return
            if (!dialogState.open) return
            const target = event.target
            const editable =
              target &&
              typeof target.closest === 'function' &&
              target.closest('[contenteditable="true"]')
            if (!editable) return
            if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
            if (dialogState.status === 'ready') {
              event.preventDefault()
              event.stopPropagation()
              answerCurrent(ctx, getConfig(), latestDraft)
              return
            }
            if (dialogState.status === 'generating') {
              event.preventDefault()
              event.stopPropagation()
            }
          }
          window.addEventListener('keydown', onKeyDown, true)
          return () => window.removeEventListener('keydown', onKeyDown, true)
        })

        // Global shortcut (default Right Ctrl + Enter) triggers the same action
        // as clicking the button.
        ctx.effect(() => {
          const onKeyDown = (event) => {
            if (event.code === 'ControlRight') rightCtrlDown = true
            if (shortcutSuspended) return
            const shortcut = getConfig().shortcut || DEFAULT_SHORTCUT
            if (!shortcut.enabled) return
            if (event.code !== shortcut.key) return
            if (!!event.shiftKey !== shortcut.shift) return
            if (!!event.altKey !== shortcut.alt) return
            if (!!event.metaKey !== shortcut.meta) return
            if (shortcut.rightCtrl) {
              if (!rightCtrlDown) return
            } else if (!!event.ctrlKey !== shortcut.ctrl) {
              return
            }
            event.preventDefault()
            event.stopPropagation()
            if (typeof runShortcut === 'function') runShortcut()
          }
          const onKeyUp = (event) => {
            if (event.code === 'ControlRight') rightCtrlDown = false
          }
          const onBlur = () => {
            rightCtrlDown = false
          }
          window.addEventListener('keydown', onKeyDown, true)
          window.addEventListener('keyup', onKeyUp, true)
          window.addEventListener('blur', onBlur)
          return () => {
            window.removeEventListener('keydown', onKeyDown, true)
            window.removeEventListener('keyup', onKeyUp, true)
            window.removeEventListener('blur', onBlur)
          }
        })


        ctx.effect(() => () => {
          offConfig()
          if (typeof disposeButton === 'function') {
            try {
              disposeButton()
            } catch {
              /* ignore */
            }
          }
        })
      },
    }
  },
})










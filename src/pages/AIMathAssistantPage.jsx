import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const KNOWLEDGE_OPTIONS = [
  { value: 'perimeter-concept', label: '周长的认识' },
  { value: 'rectangle', label: '长方形周长' },
  { value: 'square', label: '正方形周长' },
  { value: 'combined', label: '组合图形边界' },
  { value: 'application', label: '周长实际问题' },
];

const AI_API_BASE_URL = import.meta.env.VITE_AI_API_BASE_URL || 'https://api.shangjiehaoke.com';

const apiFetch = (path, options = {}) => fetch(`${AI_API_BASE_URL}${path}`, {
  credentials: 'include',
  ...options,
});

const DEMO_DIAGNOSIS = {
  recognizedAnswer: '8 + 5 = 13',
  expectedAnswer: '（8 + 5）× 2 = 26（米）',
  errorType: '周长概念理解不完整',
  possibleCause: '只计算了相邻两条边，尚未形成“封闭图形一周长度”的完整表象。',
  learningNeed: '建立“封闭一周”表象，理解四条边关系',
  confidence: 0.96,
  warnings: [],
};

const WORKFLOW = [
  {
    id: 'diagnosis',
    number: '01',
    stage: '智能诊断',
    caption: '多源采集 · 人机析因',
    status: '进行中',
  },
  {
    id: 'layering',
    number: '02',
    stage: '动态分层',
    caption: '画像分层 · 精准干预',
    status: '待开始',
  },
  {
    id: 'evaluation',
    number: '03',
    stage: '多元评价',
    caption: '多维评学 · 反馈迭代',
    status: '待开始',
  },
];

const Icon = ({ name, size = 20 }) => {
  const paths = {
    home: <><path d="m3 10 9-7 9 7"/><path d="M5 9v11h14V9"/><path d="M9 20v-7h6v7"/></>,
    spark: <><path d="m12 3 1.4 4.1a2.4 2.4 0 0 0 1.5 1.5L19 10l-4.1 1.4a2.4 2.4 0 0 0-1.5 1.5L12 17l-1.4-4.1a2.4 2.4 0 0 0-1.5-1.5L5 10l4.1-1.4a2.4 2.4 0 0 0 1.5-1.5L12 3Z"/><path d="m19 3 .5 1.5L21 5l-1.5.5L19 7l-.5-1.5L17 5l1.5-.5L19 3Z"/></>,
    upload: <><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 15v5h16v-5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    layers: <><path d="m12 3-9 5 9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 16 9 5 9-5"/></>,
    chart: <><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    edit: <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8M8 17h6"/></>,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    chevron: <path d="m9 18 6-6-6-6"/>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/></>,
    close: <><path d="m6 6 12 12M18 6 6 18"/></>,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
};

const LoginScreen = ({ onLogin }) => {
  const [username, setUsername] = useState('yuanlaoshi');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '登录失败');
      setPassword('');
      onLogin(payload.teacher);
    } catch (loginError) {
      setStatus('error');
      setError(loginError.message || '登录失败，请稍后重试');
      return;
    }
    setStatus('idle');
  };

  return (
    <main className="login-shell">
      <section className="login-story">
        <a className="login-brand" href="/">
          <span className="brand-mark"><span>π</span></span>
          <span><strong>上节好课</strong><small>AI 精准教学</small></span>
        </a>
        <div className="login-story-copy">
          <span className="eyebrow"><Icon name="spark" size={15} /> 教师专属工作台</span>
          <h1>看见每一次错误，<br />也看见成长的方向。</h1>
          <p>从学生作品出发，完成诊断、分层与评价。AI 提供建议，教师保留最终判断。</p>
        </div>
        <div className="login-proof">
          <span><Icon name="shield" size={17} /> 教师账号保护</span>
          <span><Icon name="file" size={17} /> 诊断记录可追溯</span>
          <span><Icon name="lock" size={17} /> 原始图片不留存</span>
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <span className="login-card-index">01 / TEACHER ACCESS</span>
          <h2>教师登录</h2>
          <p>登录后才能使用 AI 诊断额度，并查看自己的历史记录。</p>
          <label>
            <span>教师账号</span>
            <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="请输入教师账号" required />
          </label>
          <label>
            <span>密码</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="请输入密码" required />
          </label>
          {error && <div className="login-error"><Icon name="info" size={15} /> {error}</div>}
          <button type="submit" disabled={status === 'loading'}>
            {status === 'loading' ? '正在验证…' : '进入教师工作台'}
            {status !== 'loading' && <Icon name="arrow" size={18} />}
          </button>
          <small><Icon name="shield" size={13} /> 登录状态采用安全 Cookie 保存，密码不会存入浏览器。</small>
        </form>
      </section>
    </main>
  );
};

const HistoryDrawer = ({ open, onClose, onAuthExpired }) => {
  const [status, setStatus] = useState('idle');
  const [diagnoses, setDiagnoses] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    setStatus('loading');
    setError('');
    apiFetch('/api/diagnoses?limit=30', { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) {
          onAuthExpired();
          throw new Error('登录状态已失效');
        }
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '记录加载失败');
        setDiagnoses(payload.diagnoses || []);
        setStatus('ready');
      })
      .catch((historyError) => {
        if (historyError.name === 'AbortError') return;
        setError(historyError.message || '记录加载失败');
        setStatus('error');
      });
    return () => controller.abort();
  }, [open, onAuthExpired]);

  if (!open) return null;
  return (
    <div className="history-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside className="history-drawer" role="dialog" aria-modal="true" aria-label="诊断历史记录">
        <div className="history-heading">
          <div><span>TEACHING ARCHIVE</span><h2>诊断记录</h2><p>这里只保存文字诊断，不保存学生原始图片。</p></div>
          <button onClick={onClose} aria-label="关闭历史记录"><Icon name="close" size={20} /></button>
        </div>
        {status === 'loading' && <div className="history-empty">正在读取诊断记录…</div>}
        {status === 'error' && <div className="history-empty is-error">{error}</div>}
        {status === 'ready' && diagnoses.length === 0 && <div className="history-empty">还没有诊断记录，上传第一份学生作品后会自动出现在这里。</div>}
        {status === 'ready' && diagnoses.length > 0 && (
          <div className="history-list">
            {diagnoses.map((item) => (
              <article className="history-item" key={item.id}>
                <div className="history-item-top">
                  <span className="history-student">学生 {item.studentCode}</span>
                  <span className={`history-status is-${item.status}`}>{item.status === 'confirmed' ? '教师已确认' : '待确认'}</span>
                </div>
                <h3>{item.errorType || '等待诊断'}</h3>
                <p>{item.possibleCause || '暂无原因说明'}</p>
                <div><span>{KNOWLEDGE_OPTIONS.find((option) => option.value === item.knowledgePoint)?.label || item.knowledgePoint}</span><time>{new Date(`${item.createdAt.replace(' ', 'T')}Z`).toLocaleString('zh-CN', { hour12: false })}</time></div>
              </article>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
};

const CurriculumSelector = ({ knowledge, setKnowledge }) => (
  <div className="curriculum-selector" aria-label="教学内容选择">
    <label className="curriculum-field is-locked">
      <span>年级</span>
      <select value="grade-3" disabled aria-label="年级">
        <option value="grade-3">三年级</option>
      </select>
      <small><Icon name="lock" size={12} /> V1开放</small>
    </label>
    <span className="selector-divider"><Icon name="chevron" size={16} /></span>
    <label className="curriculum-field is-locked">
      <span>单元</span>
      <select value="geometry-perimeter" disabled aria-label="单元">
        <option value="geometry-perimeter">图形与几何 · 周长</option>
      </select>
      <small><Icon name="lock" size={12} /> V1开放</small>
    </label>
    <span className="selector-divider"><Icon name="chevron" size={16} /></span>
    <label className="curriculum-field">
      <span>知识点</span>
      <select value={knowledge} onChange={(event) => setKnowledge(event.target.value)} aria-label="知识点">
        {KNOWLEDGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
      <small className="is-ready">● 可切换</small>
    </label>
  </div>
);

const Sidebar = ({ activeView, setActiveView }) => {
  const activeIndex = WORKFLOW.findIndex((item) => item.id === activeView);

  return (
    <aside className="math-sidebar">
    <a className="assistant-brand" href="/" aria-label="返回上节好课首页">
      <span className="brand-mark"><span>π</span></span>
      <span className="brand-copy">
        <strong>上节好课</strong>
        <small>AI 精准教学</small>
      </span>
    </a>

    <div className="workflow-label">三阶六步</div>
    <nav className="workflow-nav" aria-label="教学流程">
      {WORKFLOW.map((item, index) => (
        <button
          key={item.id}
          className={`workflow-item ${activeView === item.id ? 'is-active' : ''}`}
          onClick={() => setActiveView(item.id)}
        >
          <span className="workflow-number">{item.number}</span>
          <span className="workflow-copy">
            <strong>{item.stage}</strong>
            <small>{item.caption}</small>
          </span>
          <span className="workflow-state">
            {activeView === item.id ? '当前' : index < activeIndex ? '已完成' : '待开始'}
          </span>
        </button>
      ))}
    </nav>

    <div className="sidebar-note">
      <Icon name="shield" size={18} />
      <div>
        <strong>教师始终拥有判断权</strong>
        <p>AI建议仅作辅助，所有诊断均需教师确认。</p>
      </div>
    </div>

    <a className="back-home" href="/works.html"><Icon name="home" size={17} /> 返回作品集</a>
    </aside>
  );
};

const WorksheetPreview = ({ uploadedImage }) => (
  <div className="worksheet-frame">
    {uploadedImage ? (
      <img src={uploadedImage} alt="已上传的学生作品预览" />
    ) : (
      <div className="mock-worksheet">
        <div className="worksheet-meta"><span>三年级数学随堂练习</span><span>学生 07</span></div>
        <div className="worksheet-rule" />
        <p className="question-no">3. 给下面的长方形花圃围一圈篱笆，需要多少米？</p>
        <div className="rectangle-sketch">
          <span className="side-top">8米</span>
          <span className="side-right">5米</span>
        </div>
        <div className="student-answer">
          <span>8 + 5 = 13（米）</span>
          <span className="teacher-mark">？</span>
        </div>
      </div>
    )}
    <span className="evidence-chip"><Icon name="file" size={13} /> 学习证据 01</span>
  </div>
);

const DiagnosisView = ({ knowledge, onContinue, onAuthExpired }) => {
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [uploadedImage, setUploadedImage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [diagnosis, setDiagnosis] = useState(DEMO_DIAGNOSIS);
  const [cause, setCause] = useState(DEMO_DIAGNOSIS.possibleCause);
  const [analysisStatus, setAnalysisStatus] = useState('demo');
  const [analysisError, setAnalysisError] = useState('');
  const [studentCode, setStudentCode] = useState('07');
  const [diagnosisId, setDiagnosisId] = useState('');
  const [confirmationStatus, setConfirmationStatus] = useState('idle');

  useEffect(() => () => abortRef.current?.abort(), []);

  const analyzeFile = async (file) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setAnalysisStatus('loading');
    setAnalysisError('');
    setConfirmed(false);
    setDiagnosisId('');
    setConfirmationStatus('idle');
    setIsEditing(false);

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('knowledgePoint', knowledge);
      formData.append('studentCode', studentCode.trim());
      const response = await apiFetch('/api/diagnoses/analyze', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效，请重新登录');
      }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error?.message || 'AI分析失败，请稍后重试');
      }

      setDiagnosis(payload.diagnosis);
      setCause(payload.diagnosis.possibleCause);
      setDiagnosisId(payload.meta?.diagnosisId || '');
      setAnalysisStatus('ready');
    } catch (error) {
      if (error.name === 'AbortError') return;
      setAnalysisStatus('error');
      setAnalysisError(error.message || 'AI分析失败，请稍后重试');
    }
  };

  const handleFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!studentCode.trim()) {
      setAnalysisStatus('error');
      setAnalysisError('请先填写学生编号，再上传作品');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setAnalysisStatus('error');
      setAnalysisError('图片不能超过5MB，请压缩后重新上传');
      event.target.value = '';
      return;
    }

    if (uploadedImage) URL.revokeObjectURL(uploadedImage);
    setUploadedImage(URL.createObjectURL(file));
    analyzeFile(file);
    event.target.value = '';
  };

  const confidenceLabel = `${Math.round((diagnosis.confidence || 0) * 100)}%`;
  const isReady = analysisStatus === 'ready';

  const handleConfirmation = async () => {
    if (!diagnosisId || confirmationStatus === 'loading') return;
    const nextStatus = confirmed ? 'pending' : 'confirmed';
    setConfirmationStatus('loading');
    setAnalysisError('');
    try {
      const response = await apiFetch(`/api/diagnoses/${encodeURIComponent(diagnosisId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus, possibleCause: cause }),
      });
      const payload = await response.json();
      if (response.status === 401) {
        onAuthExpired();
        throw new Error('登录状态已失效，请重新登录');
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error?.message || '诊断保存失败');
      setConfirmed(nextStatus === 'confirmed');
      setConfirmationStatus('idle');
    } catch (confirmationError) {
      setConfirmationStatus('error');
      setAnalysisError(confirmationError.message || '诊断保存失败，请稍后重试');
    }
  };

  return (
    <section className="view-panel diagnosis-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Icon name="spark" size={15} /> 第一阶 · 智能诊断</span>
          <h2>看见错误背后的思考</h2>
          <p>上传学生作品，由 AI 提取学习证据；教师确认后形成可信诊断。</p>
        </div>
        <label className="student-code-field"><span>匿名学生编号</span><input value={studentCode} onChange={(event) => setStudentCode(event.target.value.slice(0, 32))} disabled={analysisStatus === 'loading'} aria-label="匿名学生编号" /></label>
      </div>

      <div className="diagnosis-grid">
        <article className="workspace-card evidence-card">
          <div className="card-title-row">
            <div>
              <span className="step-kicker">01 / 多源采集</span>
              <h3>学生作品</h3>
            </div>
            <button className="text-button" onClick={() => inputRef.current?.click()} disabled={analysisStatus === 'loading'}><Icon name="upload" size={16} /> 更换作品</button>
          </div>
          <input ref={inputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFile} />
          <WorksheetPreview uploadedImage={uploadedImage} />
          <button className="upload-dropzone" onClick={() => inputRef.current?.click()} disabled={analysisStatus === 'loading'}>
            <span className="upload-icon"><Icon name="upload" size={20} /></span>
            <span><strong>{analysisStatus === 'loading' ? 'GLM 正在分析作品…' : '点击上传新作品'}</strong><small>支持 JPG、PNG、WEBP · 最大5MB · 请隐去学生姓名</small></span>
          </button>
        </article>

        <article className="workspace-card analysis-card">
          <div className="card-title-row">
            <div>
              <span className="step-kicker">02 / 人机析因</span>
              <h3>AI 初步诊断</h3>
            </div>
            <span className={`ai-badge ${isReady ? 'is-live' : ''}`}><Icon name="spark" size={14} /> {isReady ? 'GLM 实时结果' : 'AI 建议'}</span>
          </div>

          <div className={`recognition-block ${analysisStatus === 'loading' ? 'is-loading' : ''}`}>
            <span className="block-label">识别到的作答</span>
            <div className="math-expression">
              <span>{analysisStatus === 'loading' ? '正在识别图片内容…' : diagnosis.recognizedAnswer}</span>
              <small>{isReady ? `置信度 ${confidenceLabel}` : '上传后实时分析'}</small>
            </div>
            {isReady && <p className="expected-answer">参考答案：{diagnosis.expectedAnswer}</p>}
          </div>

          {analysisStatus === 'error' && (
            <div className="analysis-notice is-error"><Icon name="info" size={15} /><span>{analysisError}</span></div>
          )}
          {isReady && diagnosis.warnings?.length > 0 && (
            <div className="analysis-notice"><Icon name="info" size={15} /><span>{diagnosis.warnings.join('；')}</span></div>
          )}

          <div className="diagnosis-list">
            <div className="diagnosis-row">
              <span className="diagnosis-icon is-coral">错</span>
              <div><small>错误类型</small><strong>{analysisStatus === 'loading' ? '等待AI判断' : diagnosis.errorType}</strong></div>
            </div>
            <div className="diagnosis-row align-start">
              <span className="diagnosis-icon is-gold">因</span>
              <div className="editable-cause">
                <small>可能原因</small>
                {isEditing ? (
                  <textarea value={cause} onChange={(event) => setCause(event.target.value)} autoFocus />
                ) : <strong>{cause}</strong>}
              </div>
              <button className="icon-button" onClick={() => setIsEditing(!isEditing)} aria-label="修改可能原因"><Icon name={isEditing ? 'check' : 'edit'} size={16} /></button>
            </div>
            <div className="diagnosis-row">
              <span className="diagnosis-icon is-green">需</span>
              <div><small>学习需求</small><strong>{analysisStatus === 'loading' ? '分析完成后生成' : diagnosis.learningNeed}</strong></div>
            </div>
          </div>

          <div className={`teacher-confirm ${confirmed ? 'is-confirmed' : ''}`}>
            <div>
              <span className="confirm-check"><Icon name="check" size={15} /></span>
              <span><strong>{confirmed ? '教师已确认并保存' : (isReady ? 'AI草稿已保存，等待教师判断' : '请先上传学生作品')}</strong><small>{confirmed ? '教师修改已写入诊断历史记录' : (isReady ? '确认后才会生成学生画像和分层任务' : 'AI完成分析后才可确认')}</small></span>
            </div>
            <button onClick={handleConfirmation} disabled={!isReady || !diagnosisId || confirmationStatus === 'loading'}>{confirmationStatus === 'loading' ? '保存中…' : (confirmed ? '撤回确认' : '确认诊断')}</button>
          </div>
        </article>
      </div>

      <div className="view-action-row">
        <div className="privacy-tip"><Icon name="shield" size={16} /> 图片只用于本次AI分析，Worker不留存原图；请先隐去学生姓名。</div>
        <button className="primary-action" onClick={onContinue} disabled={!confirmed}>生成学习画像 <Icon name="arrow" size={18} /></button>
      </div>
    </section>
  );
};

const LayeringView = ({ knowledgeLabel, onContinue }) => {
  const [selectedLayer, setSelectedLayer] = useState('consolidation');
  const layers = [
    { id: 'support', index: 'A', title: '基础支持层', tone: 'mint', need: '借助实物建立周长表象', task: '用彩绳围出图形的一周，再把四条边逐一描出来并说出“周长在哪里”。', label: '操作理解' },
    { id: 'consolidation', index: 'B', title: '巩固发展层', tone: 'gold', need: '理解四条边及算法意义', task: '比较“8+5+8+5”与“(8+5)×2”，向同伴解释为什么需要乘2。', label: '算理表达' },
    { id: 'exploration', index: 'C', title: '迁移探究层', tone: 'coral', need: '在真实情境中灵活迁移', task: '设计一个周长为26米的长方形花圃，给出两种方案并说明你的选择。', label: '迁移探究' },
  ];

  return (
    <section className="view-panel layering-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Icon name="layers" size={15} /> 第二阶 · 动态分层</span>
          <h2>让每个孩子，从合适的台阶出发</h2>
          <p>画像不是固定标签，而是基于本次学习证据生成的动态起点。</p>
        </div>
        <button className="outline-button"><Icon name="spark" size={16} /> 重新生成任务</button>
      </div>

      <article className="profile-strip">
        <div className="student-avatar">07</div>
        <div className="profile-copy"><span>学生 07 · 当前画像</span><strong>能完成简单加法，但对“封闭图形一周”理解不完整</strong></div>
        <div className="profile-meta"><span>当前建议层级</span><strong>巩固发展层</strong></div>
        <div className="profile-meta"><span>聚焦知识点</span><strong>{knowledgeLabel}</strong></div>
      </article>

      <div className="layer-cards">
        {layers.map((layer) => (
          <button key={layer.id} className={`layer-card tone-${layer.tone} ${selectedLayer === layer.id ? 'is-selected' : ''}`} onClick={() => setSelectedLayer(layer.id)}>
            <div className="layer-top"><span className="layer-index">{layer.index}</span><span className="layer-radio"><Icon name="check" size={14} /></span></div>
            <span className="layer-label">{layer.title}</span>
            <h3>{layer.need}</h3>
            <div className="task-paper">
              <span>推荐任务</span>
              <p>{layer.task}</p>
            </div>
            <div className="layer-footer"><span>{layer.label}</span><span>约 12 分钟</span></div>
          </button>
        ))}
      </div>

      <div className="view-action-row">
        <div className="privacy-tip"><Icon name="info" size={16} /> 点击卡片可以调整层级，系统会保留教师最终选择。</div>
        <button className="primary-action" onClick={onContinue}>布置当前任务 <Icon name="arrow" size={18} /></button>
      </div>
    </section>
  );
};

const EvaluationView = () => {
  const dimensions = [
    { label: '概念理解', before: 42, after: 86 },
    { label: '算理表达', before: 35, after: 78 },
    { label: '问题解决', before: 58, after: 82 },
    { label: '错因修正', before: 30, after: 91 },
  ];

  return (
    <section className="view-panel evaluation-view">
      <div className="section-heading">
        <div>
          <span className="eyebrow"><Icon name="chart" size={15} /> 第三阶 · 多元评价</span>
          <h2>记录变化，也照见下一步</h2>
          <p>比较前后测证据，让评价成为下一轮教学的起点。</p>
        </div>
        <button className="outline-button"><Icon name="file" size={16} /> 导出学习报告</button>
      </div>

      <div className="evaluation-grid">
        <article className="workspace-card growth-card">
          <div className="card-title-row"><div><span className="step-kicker">05 / 多维评学</span><h3>学习变化</h3></div><span className="growth-badge">综合提升 +43%</span></div>
          <div className="legend"><span><i className="before-dot" />前测</span><span><i className="after-dot" />后测</span></div>
          <div className="dimension-chart">
            {dimensions.map((dimension) => (
              <div className="dimension-row" key={dimension.label}>
                <span>{dimension.label}</span>
                <div className="bars">
                  <i className="before-bar" style={{ width: `${dimension.before}%` }}><small>{dimension.before}</small></i>
                  <i className="after-bar" style={{ width: `${dimension.after}%` }}><small>{dimension.after}</small></i>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="workspace-card feedback-card">
          <div className="card-title-row"><div><span className="step-kicker">06 / 反馈迭代</span><h3>教学反馈</h3></div><span className="ai-badge"><Icon name="spark" size={14} /> AI 归纳</span></div>
          <div className="feedback-section is-solved">
            <span className="feedback-symbol"><Icon name="check" size={16} /></span>
            <div><small>已经解决</small><strong>能够指出封闭图形的一周，并完整计算四条边。</strong></div>
          </div>
          <div className="feedback-section is-pending">
            <span className="feedback-symbol">→</span>
            <div><small>仍需关注</small><strong>面对凹多边形时，偶尔遗漏内部转折边。</strong></div>
          </div>
          <div className="next-step-note">
            <span>下一步教学建议</span>
            <ol><li>增加组合图形边界描线活动</li><li>用“走一圈”的语言讲述边界顺序</li><li>两天后安排一道变式题再诊断</li></ol>
          </div>
        </article>
      </div>

      <div className="cycle-banner">
        <div className="cycle-icon"><span>评</span><i>→</i><span>调</span><i>→</i><span>诊</span></div>
        <div><strong>评价不是终点</strong><p>本次结果将自动进入下一轮诊断，持续更新学生画像。</p></div>
        <button>创建再诊断任务 <Icon name="arrow" size={17} /></button>
      </div>
    </section>
  );
};

const AIMathAssistantPage = () => {
  const [activeView, setActiveView] = useState('diagnosis');
  const [knowledge, setKnowledge] = useState('rectangle');
  const [authStatus, setAuthStatus] = useState('checking');
  const [teacher, setTeacher] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const knowledgeLabel = useMemo(
    () => KNOWLEDGE_OPTIONS.find((item) => item.value === knowledge)?.label,
    [knowledge],
  );

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [activeView]);

  const handleAuthExpired = useCallback(() => {
    setTeacher(null);
    setHistoryOpen(false);
    setAuthStatus('anonymous');
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiFetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          handleAuthExpired();
          return;
        }
        const payload = await response.json();
        setTeacher(payload.teacher);
        setAuthStatus('authenticated');
      })
      .catch((error) => {
        if (error.name !== 'AbortError') handleAuthExpired();
      });
    return () => controller.abort();
  }, [handleAuthExpired]);

  const handleLogin = (loggedInTeacher) => {
    setTeacher(loggedInTeacher);
    setAuthStatus('authenticated');
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      handleAuthExpired();
    }
  };

  if (authStatus === 'checking') {
    return <main className="auth-loading"><span className="brand-mark"><span>π</span></span><strong>正在进入教师工作台…</strong></main>;
  }

  if (authStatus !== 'authenticated' || !teacher) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="ai-math-app">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main className="assistant-main">
        <header className="assistant-topbar">
          <div className="mobile-brand"><span className="brand-mark"><span>π</span></span><strong>AI 精准教学</strong></div>
          <CurriculumSelector knowledge={knowledge} setKnowledge={setKnowledge} />
          <div className="teacher-profile">
            <span className="teacher-avatar">{teacher.displayName?.slice(0, 1) || '师'}</span>
            <span><strong>{teacher.displayName}</strong><small>三年级数学</small></span>
            <button onClick={() => setHistoryOpen(true)} title="诊断记录" aria-label="打开诊断记录"><Icon name="history" size={17} /></button>
            <button onClick={handleLogout} title="退出登录" aria-label="退出登录"><Icon name="logout" size={17} /></button>
          </div>
        </header>

        <div className="assistant-content">
          <div className="prototype-banner"><span>GLM 联调版</span><p>已接入 GLM-4.6V-Flash；AI诊断仅作建议，须由教师确认。</p></div>
          {activeView === 'diagnosis' && <DiagnosisView knowledge={knowledge} onContinue={() => setActiveView('layering')} onAuthExpired={handleAuthExpired} />}
          {activeView === 'layering' && <LayeringView knowledgeLabel={knowledgeLabel} onContinue={() => setActiveView('evaluation')} />}
          {activeView === 'evaluation' && <EvaluationView />}
        </div>
      </main>
      <HistoryDrawer open={historyOpen} onClose={() => setHistoryOpen(false)} onAuthExpired={handleAuthExpired} />
    </div>
  );
};

export default AIMathAssistantPage;

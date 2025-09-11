document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 ---
    const themeSelectionScreen = document.getElementById('theme-selection-screen');
    const storyScreen = document.getElementById('story-screen');
    const knowledgeUnits = document.querySelectorAll('.knowledge-unit');
    const unitHeaders = document.querySelectorAll('.unit-header');
    const lessonItems = document.querySelectorAll('.lesson-item');
    const scenarioCards = document.querySelectorAll('.scenario-card');
    const startBtn = document.getElementById('start-adventure-btn');
    const selectedKnowledgeSpan = document.getElementById('selected-knowledge');
    const selectedScenariosSpan = document.getElementById('selected-scenarios');
    const loadingIndicator = document.getElementById('loading-indicator');
    const storyContent = document.getElementById('story-content');
    const storyText = document.getElementById('story-text');
    const questionArea = document.getElementById('question-area');
    const questionText = document.getElementById('question-text');
    const answerInput = document.getElementById('answer-input');
    const submitAnswerBtn = document.getElementById('submit-answer-btn');
    const feedbackArea = document.getElementById('feedback-area');
    const continueAdventureBtn = document.getElementById('continue-adventure-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const backToWorksBtn = document.getElementById('back-to-works-btn');
    const hintBtn = document.getElementById('hint-btn');
    const backToQuestionBtn = document.getElementById('back-to-question-btn');
    
    // 图片相关元素
    const sceneImageContainer = document.getElementById('scene-image-container');
    const sceneImage = document.getElementById('scene-image');
    const imageLoading = document.getElementById('image-loading');
    
    // 答题相关元素
    const fillBlankAnswer = document.getElementById('fill-blank-answer');
    const multipleChoiceAnswer = document.getElementById('multiple-choice-answer');
    const choiceBtns = document.querySelectorAll('.choice-btn');
    const submitChoiceBtn = document.getElementById('submit-choice-btn');
    
    // 数字键盘相关元素
    const numberKeyboard = document.getElementById('number-keyboard');
    const choiceNumberKeyboard = document.getElementById('choice-number-keyboard');
    const choiceNumberInput = document.getElementById('choice-number-input');
    // 延迟获取按钮元素，确保DOM完全加载
    let numBtns;

    // --- 全局变量 ---
    let selectedKnowledge = [];
    let selectedScenarios = [];
    let storyHistory = [];
    let currentAnswer = null;
    let currentQuestionType = 'fill'; // 'fill' 或 'choice'
    let selectedChoice = null; // 存储选择题的选中答案
    let currentSceneDescription = ''; // 当前场景描述，用于生成图片

    // --- API 配置 (不变) ---
    const PROXY_API_URL = 'https://api.shangjiehaoke.xyz';
    const API_URL = PROXY_API_URL;
    const API_KEY = 'dummy-key'; // 代理服务器不需要真实的API Key

    // --- AI伙伴数据结构 ---
    const partnerData = {
        name: '悟空',
        images: {
            default: './wukong_default.png',
        happy: './wukong_happy.png',
        thinking: './wukong_thinking.png'
        },
        dialogues: {
            correct: [
                "答对了！你真是个数学天才！",
                "YES！又攻克一道难关！我们继续前进！",
                "太厉害了！这个答案完美无缺！",
                "我就知道，这点困难根本难不倒我们！"
            ],
            incorrect: [
                "别灰心，强大的对手才能让我们变强！再试试看！",
                "噢，这个答案似乎不太对。没关系，我们换个思路！",
                "等等，好像掉进陷阱了。别担心，我们能找到正确的路！",
                "这是一个小挑战！深呼吸，我们再来一次！"
            ]
        }
    };

    // --- 语音控制器类 ---
    class VoiceController {
        constructor() {
            this.synthesis = window.speechSynthesis;
            this.voices = [];
            this.currentUtterance = null;
            this.isSupported = !!this.synthesis;
            this.enabled = true;
            this.speaking = false;
            
            // 语音队列管理
            this.speechQueue = [];
            this.isProcessingQueue = false;
            
            // 语音参数配置
            this.config = {
                rate: 1.0,     // 语速
                pitch: 1.2,    // 音调（略高体现悟空活泼性格）
                volume: 0.8,   // 音量
                lang: 'zh-CN'  // 中文
            };
            
            this.init();
        }
        
        /**
         * 初始化语音控制器
         */
        async init() {
            if (!this.isSupported) {
                console.warn('浏览器不支持Web Speech API');
                this.handleUnsupported();
                return;
            }
            
            // 加载语音列表
            this.loadVoices();
            
            // 监听语音列表变化
            if (this.synthesis.onvoiceschanged !== undefined) {
                this.synthesis.onvoiceschanged = () => this.loadVoices();
            }
            
            // 从本地存储恢复设置
            this.loadSettings();
            
            // 初始化UI
            this.initUI();
        }
        
        /**
         * 加载可用语音列表
         */
        loadVoices() {
            this.voices = this.synthesis.getVoices();
            
            // 优先选择中文语音
            const chineseVoice = this.voices.find(voice => 
                voice.lang.includes('zh') || voice.lang.includes('CN')
            );
            
            if (chineseVoice) {
                this.selectedVoice = chineseVoice;
            }
        }
        
        /**
         * 语音合成播放（支持队列）
         * @param {string} text - 要播放的文本
         * @param {Object} options - 播放选项
         */
        speak(text, options = {}) {
            if (!this.isSupported || !this.enabled || !text.trim()) {
                return Promise.resolve({ success: false, error: 'Voice not available' });
            }
            
            const speechItem = {
                text: text.trim(),
                options: { ...this.config, ...options },
                timestamp: Date.now()
            };
            
            // 如果设置了立即播放或队列为空，直接播放
            if (options.immediate || this.speechQueue.length === 0) {
                return this.speakImmediate(speechItem);
            } else {
                // 添加到队列
                return this.addToQueue(speechItem);
            }
        }
        
        /**
         * 立即播放语音（会中断当前播放）
         * @param {Object} speechItem - 语音项目
         */
        speakImmediate(speechItem) {
            return new Promise((resolve) => {
                // 停止当前播放和清空队列
                this.stop();
                this.clearQueue();
                
                // 创建语音合成实例
                const utterance = new SpeechSynthesisUtterance(speechItem.text);
                
                // 设置语音参数
                Object.assign(utterance, speechItem.options);
                
                if (this.selectedVoice) {
                    utterance.voice = this.selectedVoice;
                }
                
                // 设置事件监听
                utterance.onstart = () => {
                    this.speaking = true;
                    this.updateSpeakingStatus(true);
                    this.triggerSpeechAnimation('start');
                };
                
                utterance.onend = () => {
                    this.speaking = false;
                    this.currentUtterance = null;
                    this.updateSpeakingStatus(false);
                    this.triggerSpeechAnimation('end');
                    resolve({ success: true });
                    
                    // 处理队列中的下一个项目
                    this.processQueue();
                };
                
                utterance.onerror = (event) => {
                    this.speaking = false;
                    this.currentUtterance = null;
                    this.updateSpeakingStatus(false);
                    this.triggerSpeechAnimation('error');
                    console.warn('语音播放失败:', event.error);
                    resolve({ success: false, error: event.error });
                    
                    // 处理队列中的下一个项目
                    this.processQueue();
                };
                
                // 开始播放
                this.currentUtterance = utterance;
                this.synthesis.speak(utterance);
            });
        }
        
        /**
         * 添加到语音队列
         * @param {Object} speechItem - 语音项目
         */
        addToQueue(speechItem) {
            return new Promise((resolve) => {
                speechItem.resolve = resolve;
                this.speechQueue.push(speechItem);
                
                // 如果当前没有播放，开始处理队列
                if (!this.speaking && !this.isProcessingQueue) {
                    this.processQueue();
                }
            });
        }
        
        /**
         * 处理语音队列
         */
        async processQueue() {
            if (this.isProcessingQueue || this.speechQueue.length === 0 || this.speaking) {
                return;
            }
            
            this.isProcessingQueue = true;
            
            while (this.speechQueue.length > 0 && this.enabled) {
                const speechItem = this.speechQueue.shift();
                
                try {
                    const result = await this.speakImmediate(speechItem);
                    if (speechItem.resolve) {
                        speechItem.resolve(result);
                    }
                } catch (error) {
                    if (speechItem.resolve) {
                        speechItem.resolve({ success: false, error });
                    }
                }
                
                // 短暂延迟，避免语音重叠
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            this.isProcessingQueue = false;
        }
        
        /**
         * 清空语音队列
         */
        clearQueue() {
            // 解决所有待处理的Promise
            this.speechQueue.forEach(item => {
                if (item.resolve) {
                    item.resolve({ success: false, error: 'Queue cleared' });
                }
            });
            this.speechQueue = [];
            this.isProcessingQueue = false;
        }
        
        /**
         * 停止语音播放
         * @param {boolean} clearQueue - 是否清空队列
         */
        stop(clearQueue = false) {
            if (this.synthesis && this.speaking) {
                this.synthesis.cancel();
                this.speaking = false;
                this.currentUtterance = null;
                this.updateSpeakingStatus(false);
                this.triggerSpeechAnimation('end');
            }
            
            if (clearQueue) {
                this.clearQueue();
            }
        }
        
        /**
         * 设置语音开关状态
         * @param {boolean} enabled - 是否启用语音
         */
        setEnabled(enabled) {
            this.enabled = enabled;
            this.saveSettings();
            this.updateUI();
            
            if (!enabled) {
                this.stop();
            }
        }
        
        /**
         * 更新播放状态UI
         * @param {boolean} speaking - 是否正在播放
         */
        updateSpeakingStatus(speaking) {
            const voiceStatus = document.getElementById('voice-status');
            if (voiceStatus) {
                voiceStatus.style.display = speaking ? 'flex' : 'none';
                
                // 更新队列状态显示
                const queueCount = this.speechQueue.length;
                if (queueCount > 0) {
                    voiceStatus.title = `正在播放语音，队列中还有 ${queueCount} 条消息`;
                } else {
                    voiceStatus.title = '正在播放语音';
                }
            }
        }
        
        /**
         * 触发语音播放动画效果
         * @param {string} type - 动画类型：'start', 'end', 'error'
         */
        triggerSpeechAnimation(type) {
            const partnerAvatar = document.getElementById('partner-avatar');
            const dialogueBubble = document.querySelector('.partner-dialogue-bubble');
            
            if (!partnerAvatar || !dialogueBubble) return;
            
            switch (type) {
                case 'start':
                    // 开始播放时的动画
                    partnerAvatar.classList.add('speaking');
                    dialogueBubble.classList.add('speaking');
                    break;
                    
                case 'end':
                    // 播放结束时的动画
                    partnerAvatar.classList.remove('speaking');
                    dialogueBubble.classList.remove('speaking');
                    break;
                    
                case 'error':
                    // 播放出错时的动画
                    partnerAvatar.classList.remove('speaking');
                    dialogueBubble.classList.remove('speaking');
                    // 可以添加错误提示动画
                    break;
            }
        }
        
        /**
         * 初始化UI控件
         */
        initUI() {
            const voiceToggle = document.getElementById('voice-toggle');
            if (voiceToggle) {
                // 设置初始状态
                this.updateUI();
                
                // 添加点击事件
                voiceToggle.addEventListener('click', () => {
                    this.setEnabled(!this.enabled);
                });
            }
        }
        
        /**
         * 更新UI状态
         */
        updateUI() {
            const voiceToggle = document.getElementById('voice-toggle');
            const voiceIcon = document.querySelector('.voice-icon');
            
            if (voiceToggle && voiceIcon) {
                if (!this.isSupported) {
                    voiceToggle.classList.add('disabled');
                    voiceToggle.title = '浏览器不支持语音功能';
                    voiceIcon.textContent = '🔇';
                } else if (this.enabled) {
                    voiceToggle.classList.remove('muted', 'disabled');
                    voiceToggle.title = '点击关闭语音';
                    voiceIcon.textContent = '🔊';
                } else {
                    voiceToggle.classList.add('muted');
                    voiceToggle.classList.remove('disabled');
                    voiceToggle.title = '点击开启语音';
                    voiceIcon.textContent = '🔇';
                }
            }
        }
        
        /**
         * 处理不支持语音的情况
         */
        handleUnsupported() {
            const voiceControl = document.querySelector('.voice-control');
            if (voiceControl) {
                voiceControl.style.display = 'none';
            }
        }
        
        /**
         * 保存设置到本地存储
         */
        saveSettings() {
            try {
                localStorage.setItem('wukong-voice-enabled', this.enabled.toString());
            } catch (e) {
                console.warn('无法保存语音设置:', e);
            }
        }
        
        /**
         * 从本地存储加载设置
         */
        loadSettings() {
            try {
                const saved = localStorage.getItem('wukong-voice-enabled');
                if (saved !== null) {
                    this.enabled = saved === 'true';
                }
            } catch (e) {
                console.warn('无法加载语音设置:', e);
            }
        }
    }
    
    // 创建全局语音控制器实例
    const voiceController = new VoiceController();

    // --- AI伙伴控制函数 ---
    /**
     * 更新AI伙伴的显示状态
     * @param {string} state - 状态名称 ('default', 'happy', 'thinking')
     * @param {string} [customMessage] - 要显示的自定义消息，如果为空则使用预设对话
     * @param {Object} voiceOptions - 语音播放选项
     */
    function updatePartner(state, customMessage = '', voiceOptions = {}) {
        const partnerAvatar = document.getElementById('partner-avatar');
        const partnerDialogue = document.getElementById('partner-dialogue-text');
        
        if (!partnerAvatar || !partnerDialogue) {
            console.warn('AI伙伴元素未找到');
            return;
        }

        // 更新图片
        partnerAvatar.src = partnerData.images[state] || partnerData.images.default;

        // 确定要显示和播放的文本
        let dialogueText = '';
        if (customMessage) {
            dialogueText = customMessage;
        } else {
            if (state === 'happy') {
                const dialogues = partnerData.dialogues.correct;
                dialogueText = dialogues[Math.floor(Math.random() * dialogues.length)];
            } else if (state === 'thinking') {
                const dialogues = partnerData.dialogues.incorrect;
                dialogueText = dialogues[Math.floor(Math.random() * dialogues.length)];
            }
        }
        
        // 更新对话文本
        partnerDialogue.textContent = dialogueText;

        // 添加动画效果
        const dialogueBubble = document.querySelector('.partner-dialogue-bubble');
        if (dialogueBubble) {
            dialogueBubble.style.animation = 'none';
            setTimeout(() => {
                dialogueBubble.style.animation = 'fadeInUp 0.5s ease';
            }, 10);
        }
        
        // 播放语音（如果有文本且语音控制器可用）
        if (dialogueText && voiceController) {
            // 根据状态调整语音参数
            const stateVoiceOptions = {
                rate: state === 'happy' ? 1.1 : 1.0,  // 开心时语速稍快
                pitch: state === 'happy' ? 1.3 : 1.2, // 开心时音调更高
                ...voiceOptions // 允许外部覆盖参数
            };
            
            // 异步播放语音，不阻塞UI
            voiceController.speak(dialogueText, stateVoiceOptions).catch(error => {
                console.warn('语音播放失败:', error);
            });
        }
    }

    // 初始化AI伙伴
    function initializePartner() {
        updatePartner('default', '小朋友，你好！我是你的冒险伙伴悟空！快来选择咱们要挑战的数学知识和冒险世界吧！');
    }
    
    /**
     * 悟空语音播放辅助函数
     * @param {string} text - 要播放的文本
     * @param {string} emotion - 情感状态：'happy', 'thinking', 'default'
     * @param {Object} options - 额外的语音选项
     */
    function speakAsWukong(text, emotion = 'default', options = {}) {
        if (!voiceController || !text) return;
        
        const emotionVoiceMap = {
            happy: { rate: 1.1, pitch: 1.3, volume: 0.9 },
            thinking: { rate: 0.9, pitch: 1.1, volume: 0.8 },
            default: { rate: 1.0, pitch: 1.2, volume: 0.8 }
        };
        
        const voiceConfig = {
            ...emotionVoiceMap[emotion] || emotionVoiceMap.default,
            ...options
        };
        
        return voiceController.speak(text, voiceConfig);
    }


    // --- 事件监听器 ---
    // 单元展开/收起逻辑
    unitHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const unit = header.parentElement;
            const lessons = unit.querySelector('.unit-lessons');
            const expandIcon = header.querySelector('.expand-icon');
            
            if (lessons.style.display === 'none' || lessons.style.display === '') {
                lessons.style.display = 'block';
                expandIcon.textContent = '▲';
                unit.classList.add('expanded');
            } else {
                lessons.style.display = 'none';
                expandIcon.textContent = '▼';
                unit.classList.remove('expanded');
            }
        });
    });

    // 课时选择逻辑
    lessonItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation(); // 防止触发单元展开/收起
            
            const knowledge = item.dataset.knowledge;
            const unit = item.dataset.unit;
            const lesson = item.dataset.lesson;
            const lessonName = item.querySelector('.lesson-name').textContent;
            
            // 创建完整的知识点描述
            const fullKnowledge = `${unit} ${lesson} ${lessonName}: ${knowledge}`;
            
            if (item.classList.contains('selected')) {
                // 取消选择
                item.classList.remove('selected');
                selectedKnowledge = selectedKnowledge.filter(k => k !== fullKnowledge);
            } else {
                // 选择知识点（最多3个）
                if (selectedKnowledge.length < 3) {
                    item.classList.add('selected');
                    selectedKnowledge.push(fullKnowledge);
                }
            }
            
            updateSelectionDisplay();
            updateStartButtonState();
        });
    });

    // 情景选择逻辑
    scenarioCards.forEach(card => {
        card.addEventListener('click', () => {
            const scenario = card.dataset.scenario;
            
            if (card.classList.contains('selected')) {
                // 取消选择
                card.classList.remove('selected');
                selectedScenarios = selectedScenarios.filter(s => s !== scenario);
            } else {
                // 选择情景（最多2个）
                if (selectedScenarios.length < 2) {
                    card.classList.add('selected');
                    selectedScenarios.push(scenario);
                }
            }
            
            updateSelectionDisplay();
            updateStartButtonState();
        });
    });

    // 更新选择显示
    function updateSelectionDisplay() {
        selectedKnowledgeSpan.textContent = selectedKnowledge.length > 0 ? selectedKnowledge.join('、') : '无';
        selectedScenariosSpan.textContent = selectedScenarios.length > 0 ? selectedScenarios.join('、') : '无';
    }

    // 更新开始按钮状态
    function updateStartButtonState() {
        startBtn.disabled = selectedKnowledge.length === 0 || selectedScenarios.length === 0;
    }
    startBtn.addEventListener('click', () => {
        if (selectedKnowledge.length > 0 && selectedScenarios.length > 0) {
            themeSelectionScreen.classList.add('hidden');
            storyScreen.classList.remove('hidden');
            storyHistory = [];
            
            // AI伙伴开始冒险反馈
            const selectedScenarioName = selectedScenarios[0]; // 获取第一个选择的情景
            updatePartner('default', `准备好了吗？我们的${selectedScenarioName}马上就要开始啦！出发！`);
            
            generateStory();
        }
    });
    // 选择题选项点击事件
    choiceBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            // 移除所有选项的选中状态
            choiceBtns.forEach(b => b.classList.remove('selected'));
            // 设置当前选项为选中状态
            btn.classList.add('selected');
            selectedChoice = String.fromCharCode(65 + index); // A, B, C, D
            
            // 显示提交按钮
            submitChoiceBtn.classList.remove('hidden');
        });
    });

    // 选择题提交按钮事件
    submitChoiceBtn.addEventListener('click', () => {
        // 检查数字输入框是否有内容
        const numberAnswer = choiceNumberInput.value.trim();
        let userAnswer;
        
        if (numberAnswer) {
            // 如果数字输入框有内容，使用数字答案
            userAnswer = numberAnswer;
        } else if (selectedChoice) {
            // 否则使用选择的选项
            userAnswer = selectedChoice;
        } else {
            feedbackArea.textContent = '请先选择一个答案或输入数字答案！';
            feedbackArea.className = 'incorrect';
            return;
        }
        
        const isCorrect = userAnswer === currentStoryData.correctChoice;
        
        // 显示正确答案
        choiceBtns.forEach((btn, index) => {
            const choice = String.fromCharCode(65 + index);
            if (choice === currentStoryData.correctChoice) {
                btn.classList.add('correct');
            } else if (choice === selectedChoice && !isCorrect && !numberAnswer) {
                // 只有在使用选项答题且答错时才标记选项为错误
                btn.classList.add('incorrect');
            }
        });
        
        // 如果使用数字输入，显示数字答案的反馈
        if (numberAnswer) {
            if (isCorrect) {
                choiceNumberInput.style.borderColor = '#4CAF50';
                choiceNumberInput.style.backgroundColor = '#E8F5E8';
            } else {
                choiceNumberInput.style.borderColor = '#f44336';
                choiceNumberInput.style.backgroundColor = '#FFEBEE';
            }
        }
        
        if (isCorrect) {
            feedbackArea.textContent = '🎉 太棒了！你答对了！';
            feedbackArea.className = 'correct';
            
            // AI伙伴庆祝反馈
            updatePartner('happy');
            
            // 延迟显示故事结尾和恢复默认状态
            setTimeout(() => {
                displayEndingStage();
                // 2-3秒后恢复默认状态
                setTimeout(() => {
                    updatePartner('default', '继续加油！');
                }, 2000);
            }, 1500);
        } else {
            feedbackArea.textContent = '哦哦，再想一想，你一定可以的！';
            feedbackArea.className = 'incorrect';
            
            // AI伙伴鼓励反馈
            updatePartner('thinking');
            
            // 2-3秒后恢复默认状态
            setTimeout(() => {
                updatePartner('default');
            }, 3000);
        }
    });

    // 分数转换函数
    function parseFraction(str) {
        if (typeof str !== 'string') return parseFloat(str);
        
        // 处理分数格式 如 "1/2", "3/4"
        const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
        if (fractionMatch) {
            const numerator = parseInt(fractionMatch[1]);
            const denominator = parseInt(fractionMatch[2]);
            return numerator / denominator;
        }
        
        // 处理普通数字
        return parseFloat(str);
    }

    // 填空题提交按钮事件
    submitAnswerBtn.addEventListener('click', () => {
        const userAnswer = answerInput.value.trim();
        
        // 支持多种答案格式的比较
        let isCorrect = false;
        
        // 先尝试直接字符串比较（适用于文字答案）
        if (userAnswer === currentAnswer) {
            isCorrect = true;
        } else {
            // 尝试数值比较（包括分数）
            const numericAnswer = parseFraction(userAnswer);
            const numericCorrect = parseFraction(currentAnswer);
            
            if (!isNaN(numericAnswer) && !isNaN(numericCorrect)) {
                isCorrect = Math.abs(numericAnswer - numericCorrect) < 0.001;
            }
        }
        
        if (isCorrect) {
            feedbackArea.textContent = '🎉 太棒了！你答对了！';
            feedbackArea.className = 'correct';
            
            // AI伙伴庆祝反馈
            updatePartner('happy');
            
            // 延迟显示故事结尾和恢复默认状态
            setTimeout(() => {
                displayEndingStage();
                // 2-3秒后恢复默认状态
                setTimeout(() => {
                    updatePartner('default', '继续加油！');
                }, 2000);
            }, 1500);
        } else {
            feedbackArea.textContent = '哦哦，再想一想，你一定可以的！';
            feedbackArea.className = 'incorrect';
            
            // AI伙伴鼓励反馈
            updatePartner('thinking');
            
            // 2-3秒后恢复默认状态
            setTimeout(() => {
                updatePartner('default');
            }, 3000);
        }
        answerInput.value = '';
    });
    continueAdventureBtn.addEventListener('click', () => {
        // 检查是否还有下一个章节
        if (currentChapterIndex + 1 < allChapters.length) {
            // 移动到下一个章节
            currentChapterIndex++;
            currentStoryData = allChapters[currentChapterIndex];
            
            // 重置填空题状态
            answerInput.value = '';
            answerInput.disabled = false;
            submitAnswerBtn.disabled = false;
            
            // 重置选择题状态
            selectedChoice = null;
            choiceBtns.forEach(btn => {
                btn.classList.remove('selected', 'correct', 'incorrect');
            });
            
            // 重置数字输入框
            if (choiceNumberInput) {
                choiceNumberInput.value = '';
                choiceNumberInput.style.borderColor = '#ddd';
                choiceNumberInput.style.backgroundColor = '';
            }
            
            submitChoiceBtn.classList.add('hidden');
            
            // 重置通用状态
            feedbackArea.textContent = '';
            continueAdventureBtn.classList.add('hidden');
            questionArea.classList.add('hidden');
            
            // 移除动画类
            feedbackArea.classList.remove('celebrate', 'shake');
            continueAdventureBtn.classList.remove('bounce');
            
            // 显示下一个章节
            displayStage1();
        } else {
            // 所有章节都完成了，显示完成信息
            storyText.textContent = '🎉 恭喜你！你已经完成了整个冒险故事！所有的数学题都答对了！';
            questionArea.classList.add('hidden');
            continueAdventureBtn.classList.add('hidden');
            
            // 显示返回首页按钮
            setTimeout(() => {
                backToHomeBtn.classList.remove('hidden');
            }, 1000);
        }
    });

    // 返回首页按钮事件监听器
    backToHomeBtn.addEventListener('click', () => {
        // 重置所有状态
        selectedKnowledge = [];
        selectedScenarios = [];
        storyHistory = [];
        currentStoryData = null;
        currentAnswer = null;
        
        // 重置UI状态
        knowledgeItems.forEach(item => item.classList.remove('selected'));
        scenarioCards.forEach(card => card.classList.remove('selected'));
        updateSelectionDisplay();
        updateStartButtonState();
        
        // 切换到首页
        storyScreen.classList.add('hidden');
        themeSelectionScreen.classList.remove('hidden');
    });

    // 返回作品按钮事件监听器
    backToWorksBtn.addEventListener('click', () => {
        // 跳转到作品页面
        window.location.href = '/works.html';
    });

    // 提示按钮事件监听器 - 修改为集成到AI伙伴对话框
    hintBtn.addEventListener('click', () => {
        if (currentStoryData && currentStoryData.hint) {
            const hintMessage = "让我想想... 提示是：" + currentStoryData.hint;
            updatePartner('thinking', hintMessage);
        } else {
            updatePartner('thinking', '让我想想... 这道题需要仔细思考一下！');
        }
    });

    // 返回题目按钮事件监听器
    backToQuestionBtn.addEventListener('click', () => {
        displayStage1();
    });
    
    // 初始化数字键盘事件监听器
    function initNumberKeyboard() {
        // 重新获取所有数字键盘按钮
        numBtns = document.querySelectorAll('.num-btn');
        console.log('找到数字键盘按钮数量:', numBtns.length);
        
        numBtns.forEach(btn => {
            // 移除可能存在的旧事件监听器
            btn.removeEventListener('click', handleNumberKeyClick);
            // 添加新的事件监听器
            btn.addEventListener('click', handleNumberKeyClick);
        });
    }
    
    // 数字键盘点击处理函数
    function handleNumberKeyClick(event) {
        const btn = event.target;
        const value = btn.dataset.value;
        console.log('点击数字键:', value);
        console.log('按钮元素:', btn);
        console.log('按钮data-value:', btn.getAttribute('data-value'));
        
        // 判断当前是哪种答题界面
        let targetInput;
        const fillBlankHidden = fillBlankAnswer.classList.contains('hidden');
        const multipleChoiceHidden = multipleChoiceAnswer.classList.contains('hidden');
        console.log('填空题界面隐藏状态:', fillBlankHidden);
        console.log('选择题界面隐藏状态:', multipleChoiceHidden);
        
        if (!fillBlankHidden) {
            // 填空题界面
            targetInput = answerInput;
            console.log('当前在填空题界面，目标输入框:', targetInput);
        } else if (!multipleChoiceHidden) {
            // 选择题界面
            targetInput = choiceNumberInput;
            console.log('当前在选择题界面，目标输入框:', targetInput);
        }
        
        if (targetInput) {
            const currentValue = targetInput.value;
            
            if (value === 'delete') {
                // 删除最后一个字符
                targetInput.value = currentValue.slice(0, -1);
            } else {
                // 添加数字或分数符号
                targetInput.value = currentValue + value;
            }
            console.log('输入框内容更新为:', targetInput.value);
        } else {
            console.log('未找到目标输入框');
        }
        
        // 添加按钮点击动画效果
        btn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            btn.style.transform = '';
        }, 100);
    }
    
    // 初始化数字键盘
     initNumberKeyboard();


    // --- 图片生成功能 ---
    async function generateSceneImage(sceneDescription) {
        try {
            // 显示加载状态
            imageLoading.classList.remove('hidden');
            sceneImage.classList.add('hidden');
            
            // 第一步：调用百炼大模型提取生图元素
            console.log('开始提取生图元素...');
            const extractResponse = await fetch(`${PROXY_API_URL}/api/generate-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: [{
                        role: 'user',
                        content: `请分析以下题目内容，提取出适合生成图片的关键视觉元素，包括：场景环境、物体、角色、颜色、风格等。请用简洁的英文关键词列出，用逗号分隔：\n\n题目内容：${sceneDescription}\n\n选择的情境：${selectedScenarios.join('、')}\n\n请只返回英文关键词，不要其他解释。`
                    }]
                })
            });
            
            if (!extractResponse.ok) {
                throw new Error('元素提取API请求失败');
            }
            
            const extractData = await extractResponse.json();
            let extractedElements = '';
            
            // 处理不同的响应格式
            if (extractData.content) {
                extractedElements = extractData.content;
            } else if (extractData.choices && extractData.choices[0] && extractData.choices[0].message) {
                extractedElements = extractData.choices[0].message.content;
            } else if (typeof extractData === 'string') {
                extractedElements = extractData;
            } else {
                console.warn('无法解析元素提取结果，使用默认元素');
                extractedElements = 'cartoon style, colorful, child-friendly';
            }
            
            console.log('提取的生图元素:', extractedElements);
            
            // 根据选择的情境添加环境元素
            let scenarioElements = '';
            if (selectedScenarios.length > 0) {
                const scenario = selectedScenarios[0];
                switch (scenario) {
                    case '神秘恐龙岛':
                        scenarioElements = ', prehistoric landscape, dinosaurs, tropical jungle, ancient ferns, volcanic mountains';
                        break;
                    case '海底探险':
                        scenarioElements = ', underwater scene, coral reefs, colorful fish, sea plants, ocean depths, bubbles';
                        break;
                    case '星际探险':
                        scenarioElements = ', space setting, planets, stars, spacecraft, alien landscapes, cosmic background';
                        break;
                    case '魔法森林寻宝':
                        scenarioElements = ', magical forest, enchanted trees, glowing mushrooms, fairy lights, mystical creatures';
                        break;
                    case '超级英雄拯救世界':
                        scenarioElements = ', superhero cityscape, modern buildings, heroic atmosphere, action scene';
                        break;
                    case '时空穿越':
                        scenarioElements = ', time portal, historical elements, futuristic and ancient mixed, swirling effects';
                        break;
                    default:
                        scenarioElements = ', adventure setting, exciting environment';
                }
            }
            
            // 第二步：构建优化的图片提示词
            const imagePrompt = `${extractedElements}${scenarioElements}, cute cartoon style, vibrant colors, child-friendly, educational illustration, kawaii style, simple and clear composition, suitable for elementary school students, digital art, anime style, cheerful atmosphere, safe and friendly environment, no scary elements`;
            
            console.log('最终生图提示词:', imagePrompt);
            
            // 第三步：调用图片生成API
            const response = await fetch(`${PROXY_API_URL}/api/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    width: 300,
                    height: 200
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`图片生成API请求失败: ${errorData.error || response.statusText}`);
            }
            
            const data = await response.json();
            console.log('图片API响应数据:', data);
            
            // 处理图片API响应数据，直接检查data.imageUrl
            let imageUrl;
            if (data.imageUrl) {
                imageUrl = data.imageUrl;
            } else {
                console.error('未知的图片API响应格式:', data);
                throw new Error('无法识别的图片API响应格式，缺少imageUrl字段');
            }
            
            // 预加载图片
            const img = new Image();
            img.onload = () => {
                sceneImage.src = imageUrl;
                sceneImage.classList.remove('hidden');
                imageLoading.classList.add('hidden');
            };
            img.onerror = () => {
                console.error('图片加载失败');
                imageLoading.innerHTML = '<p style="color: #ff6b6b;">图片加载失败，请稍后重试</p>';
            };
            img.src = imageUrl;
            
        } catch (error) {
            console.error('生成场景图片时出错:', error);
            imageLoading.innerHTML = '<p style="color: #ff6b6b;">图片生成失败，请稍后重试</p>';
        }
    }
    
    // --- 核心功能函数 (修改！) ---
    async function generateStory(isContinuation = false) {
        loadingIndicator.classList.remove('hidden');
        storyContent.classList.add('hidden');

        // 根据选择的知识点生成具体的题型要求
        const knowledgePrompts = {
            '万以内数的认识': '涉及万以内数字的读写、大小比较或位值理解',
            '两位数除以一位数': '包含两位数除以一位数的除法运算',
            '两位数乘两位数': '包含两位数乘法运算',
            '两步混合运算': '需要进行两步计算的混合运算',
            '认识几分之一': '涉及分数概念，如1/2、1/3、1/4等',
            '分数的大小比较': '比较简单分数的大小',
            '分数的简单加减': '同分母分数的加减运算',
            '时分秒': '涉及时间单位换算或时间计算',
            '长度质量单位': '涉及长度或质量单位的换算',
            '四边形性质与判定': '关于正方形、长方形、平行四边形的性质',
            '面积与周长': '计算图形的面积或周长',
            '条形统计图与数据': '读取和分析简单的统计图表',
            '两步应用题': '需要两步解决的实际应用问题'
        };

        const selectedKnowledgePrompts = selectedKnowledge.map(k => knowledgePrompts[k] || k).join('、');

        const systemPrompt = `你是一位专业的儿童故事作家和小学数学老师。请为一名小学三年级学生创作一个完整的冒险故事，包含5个连续的故事章节，每个章节都要融入一个关于【${selectedKnowledgePrompts}】的数学应用题。

题目类型要求：
1. 对于计算类题目（加减乘除、面积周长等），使用填空题形式
2. 对于比较、判断、选择类题目，使用选择题形式
3. 分数相关题目优先使用选择题形式

请严格按照以下JSON格式返回内容：
{
  "chapters": [
    {
      "story": "第1章故事情景描述，长度100-120字",
      "sceneDescription": "场景描述，用于AI生图，描述当前章节的具体场景环境，30-50字",
      "question": "具体的数学问题",
      "questionType": "题型类型：fill（填空题）或choice（选择题）",
      "answer": "正确答案",
      "choices": ["选项A", "选项B", "选项C", "选项D"],
      "correctChoice": "正确选项（A/B/C/D，仅选择题需要）",
      "hint": "解题提示和思路，不直接给出答案",
      "ending": "本章结尾，30-50字"
    },
    {
      "story": "第2章故事情景描述，长度100-120字",
      "sceneDescription": "场景描述，用于AI生图，描述当前章节的具体场景环境，30-50字",
      "question": "具体的数学问题",
      "questionType": "题型类型：fill（填空题）或choice（选择题）",
      "answer": "正确答案",
      "choices": ["选项A", "选项B", "选项C", "选项D"],
      "correctChoice": "正确选项（A/B/C/D，仅选择题需要）",
      "hint": "解题提示和思路，不直接给出答案",
      "ending": "本章结尾，30-50字"
    },
    {
      "story": "第3章故事情景描述，长度100-120字",
      "sceneDescription": "场景描述，用于AI生图，描述当前章节的具体场景环境，30-50字",
      "question": "具体的数学问题",
      "questionType": "题型类型：fill（填空题）或choice（选择题）",
      "answer": "正确答案",
      "choices": ["选项A", "选项B", "选项C", "选项D"],
      "correctChoice": "正确选项（A/B/C/D，仅选择题需要）",
      "hint": "解题提示和思路，不直接给出答案",
      "ending": "本章结尾，30-50字"
    },
    {
      "story": "第4章故事情景描述，长度100-120字",
      "sceneDescription": "场景描述，用于AI生图，描述当前章节的具体场景环境，30-50字",
      "question": "具体的数学问题",
      "questionType": "题型类型：fill（填空题）或choice（选择题）",
      "answer": "正确答案",
      "choices": ["选项A", "选项B", "选项C", "选项D"],
      "correctChoice": "正确选项（A/B/C/D，仅选择题需要）",
      "hint": "解题提示和思路，不直接给出答案",
      "ending": "本章结尾，30-50字"
    },
    {
      "story": "第5章故事情景描述，长度100-120字",
      "sceneDescription": "场景描述，用于AI生图，描述当前章节的具体场景环境，30-50字",
      "question": "具体的数学问题",
      "questionType": "题型类型：fill（填空题）或choice（选择题）",
      "answer": "正确答案",
      "choices": ["选项A", "选项B", "选项C", "选项D"],
      "correctChoice": "正确选项（A/B/C/D，仅选择题需要）",
      "hint": "解题提示和思路，不直接给出答案",
      "ending": "故事的完美结局，50-80字"
    }
  ]
}

注意：
- 5个章节要形成一个完整连贯的冒险故事
- 如果是填空题，choices和correctChoice可以为空
- 如果是选择题，必须提供4个选项，其中只有一个正确
- 不要包含任何额外的解释或标记，只返回JSON格式的内容。`;
        let userPrompt = `故事必须围绕以下冒险情景展开：${selectedScenarios.join('、')}。`;
        if (isContinuation) {
            userPrompt = `请根据上面的对话，继续创作下一段冒险故事，并融入一个新的【${selectedKnowledgePrompts}】相关的数学题。`;
        }
        if (storyHistory.length === 0) {
             storyHistory.push({ "role": "system", "content": systemPrompt });
        }
        storyHistory.push({ "role": "user", "content": userPrompt });

        try {
            console.log('即将请求的文本生成API地址是：', `${PROXY_API_URL}/api/generate-story`);
            const response = await fetch(`${PROXY_API_URL}/api/generate-story`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    messages: storyHistory
                })
            });

            if (!response.ok) {
                 const errorData = await response.json();
                 throw new Error(`中转服务器请求失败: ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            console.log('API响应数据:', data);
            
            // 处理不同的响应格式
            let storyData;
            if (data.choices && data.choices[0] && data.choices[0].message) {
                // OpenAI标准格式
                storyData = data.choices[0].message.content;
            } else if (data.output && data.output.text) {
                // 百炼大模型格式 - output.text
                storyData = data.output.text;
            } else if (data.output && typeof data.output === 'string') {
                // 百炼大模型格式 - output字符串
                storyData = data.output;
            } else if (data.result && data.result.output) {
                // 百炼大模型格式 - result.output
                storyData = data.result.output;
            } else if (data.data && data.data.output) {
                // 百炼大模型格式 - data.output
                storyData = data.data.output;
            } else if (data.content) {
                // 直接内容格式
                storyData = data.content;
            } else if (data.response) {
                // 响应字段格式
                storyData = data.response;
            } else if (data.text) {
                // 文本字段格式
                storyData = data.text;
            } else if (typeof data === 'string') {
                // 直接字符串格式
                storyData = data;
            } else {
                console.error('未知的API响应格式:', data);
                throw new Error('无法识别的API响应格式，请检查控制台日志');
            }
            
            console.log('提取的故事数据:', storyData);

            storyHistory.push({ "role": "assistant", "content": storyData });
            parseAndDisplayStoryStages(storyData);

        } catch (error) {
            console.error('调用中转站错误:', error);
            storyText.textContent = `糟糕，故事生成失败了。\n错误信息：${error.message}`;
        } finally {
            loadingIndicator.classList.add('hidden');
            storyContent.classList.remove('hidden');
        }
    }

    // 存储当前故事的完整数据
    let currentStoryData = null;
    // 存储所有章节数据
    let allChapters = [];
    // 当前章节索引
    let currentChapterIndex = 0;

    // --- 新的分阶段解析函数 ---
    function parseAndDisplayStoryStages(text) {
        try {
            // 尝试解析JSON格式
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const storyData = JSON.parse(jsonMatch[0]);
                console.log('解析到的故事数据:', storyData);
                
                // 检查是否是新的多章节格式
                if (storyData.chapters && Array.isArray(storyData.chapters)) {
                    // 存储所有章节
                    allChapters = storyData.chapters;
                    currentChapterIndex = 0;
                    console.log('多章节格式，章节数量:', allChapters.length);
                    
                    // 验证第一章节数据
                    if (!allChapters[0] || !allChapters[0].story || !allChapters[0].question) {
                        throw new Error('第一章节数据格式不完整');
                    }
                    
                    // 存储当前章节数据
                    currentStoryData = allChapters[0];
                } else {
                    // 兼容旧的单章节格式
                    console.log('单章节格式，使用兼容模式');
                    if (!storyData.story || !storyData.question) {
                        throw new Error('故事数据格式不完整');
                    }
                    
                    // 存储完整的故事数据
                    currentStoryData = storyData;
                    allChapters = [storyData]; // 转换为章节数组格式
                    currentChapterIndex = 0;
                }
            } else {
                throw new Error('未找到JSON格式内容');
            }

            // 显示第一阶段：故事情景和问题
            displayStage1();
            
        } catch (error) {
            console.error('解析故事数据失败:', error);
            // 回退到旧格式解析
            parseAndDisplayStoryLegacy(text);
        }
    }

    // 显示第一阶段：故事和问题
    function displayStage1() {
        if (!currentStoryData) return;
        
        // 生成场景图片
        if (currentStoryData.sceneDescription) {
            generateSceneImage(currentStoryData.sceneDescription);
        }
        
        // 设置当前题型和答案
        currentQuestionType = currentStoryData.questionType || 'fill';
        currentAnswer = currentStoryData.answer;
        
        console.log('题型设置:', {
            原始questionType: currentStoryData.questionType,
            设置后的currentQuestionType: currentQuestionType,
            是否为选择题: currentQuestionType === 'choice'
        });
        
        // 显示故事和问题
        storyText.textContent = currentStoryData.story;
        questionText.textContent = currentStoryData.question;
        
        // 根据题型显示相应的答题界面
        if (currentQuestionType === 'choice') {
            // 显示选择题界面
            fillBlankAnswer.classList.add('hidden');
            multipleChoiceAnswer.classList.remove('hidden');
            
            // 设置选择题选项
            console.log('选择题数据检查:', {
                hasChoices: !!currentStoryData.choices,
                choicesLength: currentStoryData.choices ? currentStoryData.choices.length : 0,
                choices: currentStoryData.choices,
                questionType: currentStoryData.questionType
            });
            
            // 设置选择题选项，确保所有4个按钮都有内容
            choiceBtns.forEach((btn, index) => {
                btn.classList.remove('selected', 'correct', 'incorrect');
            });
            
            // 重置数字输入框
            if (choiceNumberInput) {
                choiceNumberInput.value = '';
                choiceNumberInput.style.borderColor = '#ddd';
                choiceNumberInput.style.backgroundColor = '';
            }
            
            choiceBtns.forEach((btn, index) => {
                
                let optionText = `选项${index + 1}`; // 默认文本
                
                if (currentStoryData.choices && Array.isArray(currentStoryData.choices)) {
                    const choice = currentStoryData.choices[index];
                    if (choice && typeof choice === 'string' && choice.trim() !== '') {
                        // 如果选项是有效的非空字符串，使用它
                        optionText = choice.trim();
                    } else if (choice && typeof choice === 'object' && choice.text) {
                        // 如果选项是对象格式，尝试获取text属性
                        optionText = choice.text.trim();
                    }
                }
                
                btn.textContent = `${String.fromCharCode(65 + index)}. ${optionText}`;
                console.log(`选项${String.fromCharCode(65 + index)}设置为:`, btn.textContent);
            });
            
            if (currentStoryData.choices && currentStoryData.choices.length === 4) {
                console.log('选择题选项已设置（完整数据）');
            } else {
                console.warn('选择题数据不完整，使用默认选项:', currentStoryData.choices);
            }
            selectedChoice = null;
            // 初始化时隐藏提交按钮
            submitChoiceBtn.classList.add('hidden');
        } else {
            // 显示填空题界面
            fillBlankAnswer.classList.remove('hidden');
            multipleChoiceAnswer.classList.add('hidden');
            answerInput.value = '';
        }
        
        // 显示第一阶段，隐藏其他阶段
        document.getElementById('story-stage-1').classList.remove('hidden');
        document.getElementById('hint-stage').classList.add('hidden');
        document.getElementById('story-ending-stage').classList.add('hidden');
        
        questionArea.classList.remove('hidden');
        feedbackArea.textContent = '';
        submitAnswerBtn.disabled = false;
        
        // 清空答案输入框
        answerInput.value = '';
        
        // 重新初始化数字键盘事件监听器
        setTimeout(() => {
            initNumberKeyboard();
        }, 100);
    }

    // 显示提示阶段
    function displayHintStage() {
        if (!currentStoryData) return;
        
        document.getElementById('hint-content').textContent = currentStoryData.hint;
        
        // 显示提示阶段，隐藏其他阶段
        document.getElementById('story-stage-1').classList.add('hidden');
        document.getElementById('hint-stage').classList.remove('hidden');
        document.getElementById('story-ending-stage').classList.add('hidden');
    }

    // 显示故事结尾阶段
    function displayEndingStage() {
        if (!currentStoryData) return;
        
        document.getElementById('story-ending-text').textContent = currentStoryData.ending;
        
        // 显示结尾阶段，隐藏其他阶段
        document.getElementById('story-stage-1').classList.add('hidden');
        document.getElementById('hint-stage').classList.add('hidden');
        document.getElementById('story-ending-stage').classList.remove('hidden');
        
        console.log('当前章节索引:', currentChapterIndex, '总章节数:', allChapters.length);
        
        // 显示继续冒险按钮（如果还有更多章节）
        if (currentChapterIndex + 1 < allChapters.length) {
            console.log('显示继续冒险按钮');
            continueAdventureBtn.classList.remove('hidden');
        } else {
            console.log('最后一个章节，显示完成信息');
            // 如果是最后一个章节，显示完成信息
            setTimeout(() => {
                document.getElementById('story-ending-text').textContent += '\n\n🎉 恭喜你！你已经完成了整个冒险故事！';
                backToHomeBtn.classList.remove('hidden');
            }, 1000);
        }
    }

    // 兼容旧格式的解析函数
    function parseAndDisplayStoryLegacy(text) {
        const questionRegex = /<q>(.*?)<\/q>/;
        const answerRegex = /<a>(.*?)<\/a>/;
        const questionMatch = text.match(questionRegex);
        const answerMatch = text.match(answerRegex);
        const cleanText = text.replace(/<q>.*?<\/q>/, '').replace(/<a>.*?<\/a>/, '').trim();

        if (questionMatch && answerMatch) {
            currentAnswer = parseInt(answerMatch[1], 10);
            const question = questionMatch[1];
            storyText.textContent = cleanText;
            questionText.textContent = question;
            questionArea.classList.remove('hidden');
            feedbackArea.textContent = '';
            submitAnswerBtn.disabled = false;
        } else {
            storyText.textContent = cleanText;
            questionArea.classList.add('hidden');
            document.getElementById('continue-adventure-btn').classList.remove('hidden');
        }
    }

    // --- 继续故事生成函数 ---
    // generateContinueStory函数已删除，现在使用预生成的章节数据
    
    // 页面加载完成后初始化AI伙伴
    initializePartner();
});
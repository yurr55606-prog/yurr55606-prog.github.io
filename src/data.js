const photoAssetUrls = import.meta.glob('./assets/gallery/*/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default'
});

const videoAssetUrls = import.meta.glob('./assets/videos/**/*.{mp4,png}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const automationImageAssetUrls = import.meta.glob('./assets/automation/screens/*.png', {
  eager: true,
  query: '?url',
  import: 'default'
});

const automationVideoAssetLoaders = import.meta.glob('./assets/automation/videos/*.mp4', {
  query: '?url',
  import: 'default'
});

const productImageAssetUrls = import.meta.glob('./assets/product/**/*.{jpg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default'
});

const productVideoAssetLoaders = import.meta.glob('./assets/product/**/*.mp4', {
  query: '?url',
  import: 'default'
});

const resolveAsset = (catalog, path) => {
  const url = catalog[path];
  if (!url) throw new Error(`Missing protected asset: ${path}`);
  return url;
};

const automationAsset = (path) => resolveAsset(automationImageAssetUrls, `./assets/automation/${path}`);
const productAsset = (path) => resolveAsset(productImageAssetUrls, `./assets/product/${path}`);

export const resolveAutomationVideo = async (path) => {
  const loader = automationVideoAssetLoaders[`./assets/automation/${path}`];
  if (!loader) throw new Error(`Missing automation video: ${path}`);
  return loader();
};

export const resolveProductVideo = async (path) => {
  const loader = productVideoAssetLoaders[`./assets/product/${path}`];
  if (!loader) throw new Error(`Missing product video: ${path}`);
  return loader();
};

export const categories = {
  plugin: {
    index: '01 / 04',
    kicker: 'AUTOMATION SYSTEMS',
    title: '自动化',
    description: '围绕 Chrome 扩展与本地浏览器工具，把采集、下载、标注、分镜、评测这些重复动作整理成稳定、可视化、可导出的自动化工作流。',
    accent: '#ffd49a',
    works: [
      {
        id: 'blobstore-key',
        code: '🔑',
        version: '1.2.0',
        title: 'Key 自动采集助手',
        shortTitle: 'Key 自动采集',
        tagline: '从当前页面与接口响应中一键抓取 Key，并沉淀成可导出的记事本。',
        type: 'CHROME EXTENSION',
        accent: '#8b5cf6',
        preview: automationAsset('screens/key-capture.png'),
        what: '一款用于网页数据采集的 Chrome 扩展。它会扫描当前页面、页面源码与已捕获接口响应，把识别到的 Key 自动写入插件侧边栏，并支持手动补充。',
        problem: '过去需要打开开发者工具、搜索接口、复制字段、再粘贴到表格里。这个流程很慢，也容易漏掉隐藏在响应里的 Key。',
        result: '把“查找—复制—保存—导出”变成一个面板内的轻量流程。',
        features: ['一键抓取当前页面', '接口响应扫描', '手动粘贴补录', '复制全部 / TXT / CSV 导出'],
        steps: ['打开需要采集 Key 的网页。', '点击“一键抓取当前页面”，等待插件扫描页面与接口响应。', '复核记录，必要时手动添加 Key。', '一键复制全部，或导出 TXT / CSV。']
      },
      {
        id: 'vision-annotation',
        code: '🖼️',
        version: '2.4.0',
        title: '图片描述 · 视界标注工作台',
        shortTitle: '图片描述',
        tagline: '把图片队列转化为镜头、焦距、色调、光影等结构化摄影语言。',
        type: 'IMAGE ANNOTATION STUDIO',
        accent: '#61a5ff',
        preview: automationAsset('screens/image-annotation.png'),
        videos: [
          { label: '图片描述演示 · 男生素材', path: 'videos/video-description-demo-full.mp4' }
        ],
        what: '面向摄影图片与 AI 图像素材的标注工作台。支持拖入图片、导入表格、批量 AI 标注，并把视觉语言整理成可导出的 JSON / CSV。',
        problem: '摄影素材往往数量多、标签维度复杂；如果全靠人工判断镜头、焦距、色调、光影和构图，效率低且标准不统一。',
        result: '把“看图—判断—填写—复核”集中在同一界面里，让图片资产更容易检索和复用。',
        features: ['图片队列管理', 'AI 智能标注', '镜头 / 焦距 / 色调 / 光影标签', 'JSON / CSV 导出'],
        steps: ['拖入图片或 Excel / CSV 表格。', '选择需要标注的摄影维度。', '批量 AI 标注后逐张复核。', '完成后导出 JSON 或 CSV。']
      },
      {
        id: 'video-batch-download',
        code: '⬇️',
        version: '1.0.0',
        title: '视频批量下载助手',
        shortTitle: '视频批量下载',
        tagline: '识别页面视频直链，并把多条链接变成可追踪的并发下载任务。',
        type: 'BATCH VIDEO',
        accent: '#8b5cf6',
        preview: automationAsset('screens/video-batch-download.png'),
        what: '面向网页视频素材收集的 Chrome 扩展。它可以识别当前页面中的视频链接，支持设置并发数、下载文件夹、任务重试和结果导出。',
        problem: '逐条打开链接、重复点击保存，既打断工作节奏，也很难确认大批任务中哪些已经完成、哪些需要重试。',
        result: '用一个清晰的任务面板替代重复操作，让批量下载的结果始终可见。',
        features: ['当前页面链接识别', '并发下载控制', '失败任务重试', '结果 CSV 导出'],
        steps: ['打开包含目标视频的页面。', '让插件自动识别视频直链，或手动粘贴链接。', '选择并发数与下载文件夹后开始任务。', '查看成功、进行中、失败、等待状态，并导出结果 CSV。']
      },
      {
        id: 'video-timestamp',
        code: '⏱️',
        version: '1.1.0',
        title: '视频时间戳采集助手',
        shortTitle: '视频时间戳采集',
        tagline: '观看视频的同时，用快捷键留下准确的入点与出点。',
        type: 'VIDEO TIMESTAMP',
        accent: '#22a7f0',
        preview: automationAsset('screens/video-timestamp.png'),
        what: '一款针对网页视频的片段时间戳工具。播放过程中可用快捷键记录入点与出点，并在侧边栏集中管理、整理和导出片段。',
        problem: '依靠暂停、抄写时间码和手工整理片段，操作频繁且容易出现时间偏差；长视频或多片段任务尤其低效。',
        result: '让“观看—判断—标记”保持在同一节奏里，为剪辑、审核和内容拆条快速建立片段清单。',
        features: ['A / D / S 快捷键打点', '页面计时器', '入点出点片段管理', 'CSV 导出'],
        steps: ['打开包含目标视频的网页并唤出插件侧边栏。', '播放视频，使用 A 记录入点、D 记录出点、S 保存片段。', '在侧边栏复核、调整并导出所需的时间戳记录。']
      },
      {
        id: 'video-description',
        code: '🎬',
        version: '1.0.0',
        title: '镜语分镜 · 视频描述工作台',
        shortTitle: '视频描述',
        tagline: '把 1 分钟内的视频拆成连续分镜，生成构图、主体、动作、运镜、色调与氛围描述。',
        type: 'VIDEO DESCRIPTION STUDIO',
        accent: '#5b6cff',
        preview: automationAsset('screens/video-description.png'),
        videos: [
          { label: '分镜演示 · 完整流程', path: 'videos/video-description-demo.mp4' }
        ],
        what: '一个本地视频分镜描述工具。上传本地视频后，它会在浏览器中抽帧、切段，并按构图、主体、动作、运镜、色调、光影、环境、服饰、角度、氛围生成连续描述。',
        problem: '视频描述常常依赖人工逐帧观看和手写总结。对短片、广告、素材库和模型训练来说，这会非常耗时，也很难保持描述结构一致。',
        result: '把视频拆解成可复制、可导出的分镜语言，为剪辑复盘、素材检索和 AI 训练数据准备提供基础。',
        features: ['本地视频处理', '自动分镜切段', '关键帧缩略图', '连续结构化描述', 'JSON / CSV 导出'],
        steps: ['选择需要分析的本地视频文件。', '设置切分方式与目标段长。', '生成连续分镜描述，并复核每段缩略图。', '复制单段或导出完整 JSON / CSV。']
      },
      {
        id: 'video-preclassification',
        code: '🧑‍🚀',
        version: '1.0.0',
        title: '视频智能预分类工作台',
        shortTitle: '视频预分类',
        tagline: '批量扫描本地视频样本，用多模态模型先完成类型预筛，再把低置信度样本交给人工复核。',
        type: 'AI VIDEO CLASSIFIER',
        accent: '#77b7ff',
        preview: automationAsset('screens/video-preclassification.png'),
        what: '一套面向视频评测前置筛选的本地自动化工作台。它可以扫描本地视频目录，接入 Demo、Gemini、OpenAI、Claude、OpenAI 兼容接口或自定义 Webhook，对视频内容进行智能预分类，并输出结构化结果。',
        problem: '视频评测样本数量一多，人工逐条观看、判断类型和筛选目标样本会非常耗时；不同评测人员的分类标准也容易不一致，后续复核成本会被放大。',
        result: '用“AI 预分类 + 置信度分流 + 人工复核”的方式，把重复筛选前置自动化，帮助评测人员更快锁定目标样本，并让团队视频评测整体效率提升约 30%。',
        features: ['本地目录批量扫描', 'Demo / Gemini / OpenAI / Claude / Webhook 接入', '目标样本规则配置', '低置信度自动复核', '人工修正分类', 'CSV 导出'],
        steps: ['启动本地服务并打开视频智能预分类工作台。', '选择 AI 服务商，配置模型名、API Key、最大抽帧数和人工复核阈值。', '填写分类标签与目标样本规则，点击“选择目录”扫描本地视频文件夹。', '开始自动分类，系统根据视频元数据、关键帧或多模态模型输出一级分类、二级分类、目标判断和置信度。', '复核低置信度、uncertain 或证据不足的样本，必要时手动修改结果。', '确认结果后导出 CSV，用于后续评测、筛选或流程记录。']
      },
      {
        id: 'evaluation-radar',
        code: '📊',
        version: '1.0.0',
        title: '评测雷达 · Excel 异常检测',
        shortTitle: '评测雷达',
        tagline: '在多轮评测表里，快速发现分数、空值与结构异常。',
        type: 'QUALITY CONTROL',
        accent: '#4e8cff',
        preview: automationAsset('screens/evaluation-radar.png'),
        videos: [
          { label: '评测演示 · 精简素材', path: 'videos/video-description-demo-short.mp4' }
        ],
        what: '面向多轮评测结果的 Excel 质量检查工具。它会集中检测评分差异、关键空值与表格结构异常，帮助使用者在分析前先确认数据是否可靠。',
        problem: '多轮评测表规模大、字段多，仅靠人工抽查很难同时发现异常分差、遗漏值和结构错位，错误还可能继续传递到后续结论。',
        result: '把质量检查前置，以异常清单替代盲目翻表，让评测数据更快进入可分析状态。',
        features: ['五分评分法 / GSB 评分法', '多评测 Sheet 对比', '异常阈值配置', '本地浏览器处理'],
        steps: ['导入需要检查的多轮评测 Excel 文件。', '选择评分方法、评测 Sheet 与检测维度。', '运行检测，扫描评分差异、空值与结构问题。', '根据异常清单回到原表定位并修正数据。']
      }
    ]
  },
  product: {
    index: '04 / 04',
    kicker: 'PRODUCTS BUILT WITH INTENT',
    title: '产品',
    description: '从问题定义、产品设计到开发与上线，这里展示我独立构建的完整数字产品。',
    accent: '#d8e8f5',
    works: [
      {
        id: 'evehut-ai-wardrobe',
        code: '衣',
        version: '1.0.0',
        title: '伊屋 EveHut · AI 智能衣橱',
        shortTitle: '伊屋 EveHut',
        tagline: '衣橱更懂你，每天更像自己',
        type: 'AI FASHION PRODUCT',
        accent: '#d8e8f5',
        preview: productAsset('evehut/hero.png'),
        logo: productAsset('evehut/logo.jpg'),
        covers: [productAsset('evehut/hero.png')],
        videos: [{ label: '伊屋 EveHut 产品演示', path: 'evehut/demo.mp4' }],
        website: 'https://evehut77-d4gpnufz05c1e9ec4-1455866191.ap-shanghai.app.tcloudbase.com/',
        what: '一款面向日常穿搭决策的响应式 AI 产品。我独立完成产品规划、视觉设计、前后端开发、AI 服务适配和线上部署，让用户能够管理自己的数字衣橱、获得搭配建议，并通过图片或实时画面评价一套穿搭。',
        problem: '普通用户常常不是“没有衣服”，而是不清楚已有单品的风格、适用场景和组合逻辑。单纯调用通用大模型也容易给出空泛建议，因此产品需要同时具备个人衣橱数据、稳定评分规则和可检索的专业穿搭知识。',
        result: '完成可公开访问的产品版本：支持邮箱注册、衣物识别、智能搭配、十维穿搭评价、多模型 API 配置，以及“小区”、好友和消息等社区能力。',
        features: ['数字衣橱与衣物识别', '十维穿搭评分体系', '实时摄像头穿搭评价', 'Kimi / 千问 / DeepSeek / Claude 等多模型适配', 'Obsidian 本地穿搭知识库', '56 类风格多维标签体系', '小区 / 好友 / 消息', '邮箱账户与腾讯云部署'],
        knowledgeBase: {
          summary: '我使用 Obsidian 搭建了本地穿搭知识库，把零散的风格图片与判断经验整理成可维护、可追溯的规则资产，再让产品在识别和评价时检索这些规则。',
          facts: ['以 9 张风格规则图作为定义基础', '整理 56 类常见服装风格及其颜色、廓形、材质、图案和场景证据', '对穿搭摄影图片建立多维标签与案例档案', '将规则库、案例库与独立评测集分开', '支持后续补充图片、人工修正标签和更新评分规则']
        },
        steps: ['从真实穿搭困扰出发，梳理数字衣橱、智能搭配、穿搭评价与社区互动的产品流程。', '在 Obsidian 中建立本地知识库，制定多维风格分类规则。', '设计十维评分体系和尊重性评价边界，让系统评价衣服与搭配效果。', '完成响应式前端、账户体系、图片存储、社区关系和多家 AI API 的服务端适配。', '迁移到腾讯云 CloudBase，完成注册、登录、图片上传和社区链路验收。', '建立 35 项自动化测试，覆盖知识库规则、AI 输出结构、隐私删除、移动端布局与关键产品流程。']
      }
    ]
  },
  photo: {
    index: '02 / 04',
    kicker: 'LIGHT BECOMES MEMORY',
    title: '摄影作品',
    description: '摄影是我与时间相处的方式。光线只经过一次，而快门把那一瞬变成可以重新抵达的坐标。',
    accent: '#f4b86d',
    works: [
      { year: '2026', type: '城市 / 夜', title: '灯火背面', text: '在城市熄灭之前，记录那些没有被注意到的微弱亮光。' },
      { year: '2025', type: '纪实 / 旅途', title: '风经过以后', text: '关于陌生道路、短暂停留，以及人在旷野中的尺度。' },
      { year: '2025', type: '静物 / 光影', title: '静默引力', text: '日常物件之间也存在引力，只是运动得足够缓慢。' }
    ]
  },
  video: {
    index: '03 / 04',
    kicker: 'TIME FINDS ANOTHER VOICE',
    title: '视频作品',
    description: '影像让空间开始呼吸，也让时间拥有剪辑之外的回声。这里保存短片、动态实验与尚未结束的叙事。',
    accent: '#ffe8bd',
    works: [
      { year: '2026', type: '实验短片 · 03:42', title: '坠入一束光', text: '一次关于速度、失重与重新看见的视觉实验。' },
      { year: '2025', type: '旅行影像 · 06:18', title: '远方的回声', text: '声音比画面更早抵达，记忆比旅途停留得更久。' },
      { year: '2025', type: '动态设计 · 01:26', title: '时间切片', text: '把同一瞬间展开，观察运动如何改变我们对空间的理解。' }
    ]
  }
};

const makePhotoItems = (folder, prefix, count, excluded = []) => {
  const excludedSet = new Set(excluded);
  return Array.from({ length: count }, (_, index) => index + 1)
    .filter((number) => !excludedSet.has(number))
    .map((number) => ({
      id: `${folder}-${String(number).padStart(2, '0')}`,
      src: resolveAsset(
        photoAssetUrls,
        `./assets/gallery/${folder}/${prefix}-${String(number).padStart(2, '0')}.jpg`
      ),
      thumbnail: `/thumbs/gallery/${folder}/${prefix}-${String(number).padStart(2, '0')}.webp`
    }));
};

export const photoAlbums = [
  {
    id: 'real',
    eyebrow: 'REAL MOMENTS / 46 FRAMES',
    title: '真实图片',
    description: '被光线真实触碰过的瞬间。',
    covers: [23, 37, 21],
    items: makePhotoItems('real', 'real', 47, [44])
  },
  {
    id: 'ai',
    eyebrow: 'SYNTHETIC DREAMS / 08 FRAMES',
    title: 'AI 图片',
    description: '现实之外，由想象重新显影。',
    covers: [5, 2, 3],
    items: makePhotoItems('ai', 'ai', 8)
  }
];

export const videoItems = [
  { id: 'showreel-01', duration: '01:05' },
  { id: 'showreel-02', duration: '00:41' },
  { id: 'showreel-03', duration: '00:14' },
  { id: 'showreel-04', duration: '00:08' },
  { id: 'showreel-05', duration: '01:00' },
  { id: 'showreel-06', duration: '00:26' },
  { id: 'showreel-07', duration: '02:59' }
].map((item) => ({
  ...item,
  src: resolveAsset(videoAssetUrls, `./assets/videos/showreel/${item.id}.mp4`),
  poster: resolveAsset(videoAssetUrls, `./assets/videos/showreel/posters/${item.id}.png`),
  thumbnail: `/thumbs/videos/${item.id}.webp`
}));

export const categories = {
  plugin: {
    index: '01 / 03',
    kicker: 'TOOLS AS IMAGINATION',
    title: '插件作品',
    description: '把重复劳动折叠成五件轻量工具，让采集、标注、下载、剪辑与评测回到清晰而可靠的工作流。',
    accent: '#ffd49a',
    works: [
      {
        id: 'blobstore-key',
        code: 'B',
        version: '1.0.0',
        title: 'BlobstoreKey 自动采集助手',
        shortTitle: '自动采集助手',
        tagline: '从网页与接口响应中，一键定位并保存 BlobstoreKey。',
        type: 'DATA CAPTURE',
        accent: '#d7e7ff',
        what: '一款面向网页数据采集流程的 Chrome 扩展。它会扫描当前页面及相关接口响应中的 BlobstoreKey，并把结果写入插件内置记录。',
        problem: 'BlobstoreKey 往往散落在页面结构或网络响应中。手动打开开发者工具逐条检索，不仅耗时，也容易漏记、重复记录或复制错误。',
        result: '把“查找—复制—整理”压缩成一次扫描，让关键数据可追溯、可复用。',
        steps: ['打开需要采集信息的目标网页。', '启动插件并执行当前页面与接口响应扫描。', '检查识别结果，确认后保存到插件内置记录。']
      },
      {
        id: 'vision-annotation',
        code: '◎',
        version: '2.4.0',
        title: '视界标注 · 图片数据工作台',
        shortTitle: '图片数据工作台',
        tagline: '把网页图片与表格素材转化为可用的结构化视觉数据。',
        type: 'MULTIMODAL AI',
        accent: '#b9e8ff',
        what: '一个支持网页抓取与表格批量导入的图片数据工作台。通过多模态 API，为图片自动生成摄影标签、内容描述与融合文案。',
        problem: '图片收集、逐张理解、标签编写和文案整理通常分散在多个工具里；数量一多，命名不一致和人工重复劳动会迅速放大。',
        result: '让图片从“散落素材”变成统一、可检索、可继续加工的数据资产。',
        steps: ['抓取当前页面图片，或批量导入表格中的图片。', '配置多模态 API，并选择需要生成的标注内容。', '批量生成标签、描述与融合文案，复核后整理或导出。']
      },
      {
        id: 'video-batch-download',
        code: '↓',
        version: '1.0.0',
        title: '视频批量下载助手',
        shortTitle: '视频批量下载',
        tagline: '把多条视频直链，变成一次可追踪的并发下载任务。',
        type: 'BATCH WORKFLOW',
        accent: '#e9ddff',
        what: '用于批量处理视频直链的下载工具。一次输入多条地址后，可并发执行任务，并持续显示每一条的成功或失败状态。',
        problem: '逐条打开链接、重复点击保存，既打断工作节奏，也很难确认大批任务中哪些已经完成、哪些需要重试。',
        result: '用一个清晰的任务面板替代重复操作，让批量下载的结果始终可见。',
        steps: ['整理并粘贴需要下载的视频直链。', '检查任务列表后启动并发下载。', '查看成功与失败状态，并针对失败项目重新处理。']
      },
      {
        id: 'video-timestamp',
        code: '⌁',
        version: '1.1.0',
        title: '视频时间戳采集助手',
        shortTitle: '视频时间戳采集',
        tagline: '观看视频的同时，用快捷键留下准确的入点与出点。',
        type: 'VIDEO INDEXING',
        accent: '#ffd7bf',
        what: '一款针对网页视频的片段时间戳工具。播放过程中可用快捷键记录入点与出点，并在侧边栏集中管理、整理和导出片段。',
        problem: '依靠暂停、抄写时间码和手工整理片段，操作频繁且容易出现时间偏差；长视频或多片段任务尤其低效。',
        result: '让“观看—判断—标记”保持在同一节奏里，为剪辑、审核和内容拆条快速建立片段清单。',
        steps: ['打开包含目标视频的网页并唤出插件侧边栏。', '播放视频，使用快捷键依次记录片段入点与出点。', '在侧边栏复核、调整并导出所需的时间戳记录。']
      },
      {
        id: 'evaluation-radar',
        code: '◇',
        version: '1.0.0',
        title: '评测雷达 · Excel 异常检测',
        shortTitle: 'Excel 异常检测',
        tagline: '在多轮评测表里，快速发现分数、空值与结构异常。',
        type: 'QUALITY CONTROL',
        accent: '#d9f5db',
        what: '面向多轮评测结果的 Excel 质量检查工具。它会集中检测评分差异、关键空值与表格结构异常，帮助使用者在分析前先确认数据是否可靠。',
        problem: '多轮评测表规模大、字段多，仅靠人工抽查很难同时发现异常分差、遗漏值和结构错位，错误还可能继续传递到后续结论。',
        result: '把质量检查前置，以异常清单替代盲目翻表，让评测数据更快进入可分析状态。',
        steps: ['导入需要检查的多轮评测 Excel 文件。', '运行检测，扫描评分差异、空值与结构问题。', '根据异常清单回到原表定位并修正数据。']
      }
    ]
  },
  photo: {
    index: '02 / 03',
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
    index: '03 / 03',
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
      src: `/gallery/${folder}/${prefix}-${String(number).padStart(2, '0')}.jpg`
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
  { id: 'video-01', src: '/videos/video-01.mp4', poster: '/videos/posters/video-01.png', duration: '00:41' },
  { id: 'video-02', src: '/videos/video-02.mp4', poster: '/videos/posters/video-02.png', duration: '00:14' },
  { id: 'video-03', src: '/videos/video-03.mp4', poster: '/videos/posters/video-03.png', duration: '00:26' },
  { id: 'video-04', src: '/videos/video-04.mp4', poster: '/videos/posters/video-04.png', duration: '00:08' },
  { id: 'video-05', src: '/videos/video-05.mp4', poster: '/videos/posters/video-05.png', duration: '02:59' },
  { id: 'video-06', src: '/videos/video-06.mp4', poster: '/videos/posters/video-06.png', duration: '01:00' }
];

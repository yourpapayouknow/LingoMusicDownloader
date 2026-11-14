// 前端共享设置键、地区预设与静态文案常量
export const SETTINGS_KEY_CODEC = 'lingomusic-codec'
export const SETTINGS_KEY_RESOLUTION = 'lingomusic-resolution'
export const SETTINGS_KEY_METADATA_REGION = 'lingomusic-metadata-region'
export const SETTINGS_KEY_USE_WRAPPER = 'lingomusic-use-wrapper'
export const SETTINGS_KEY_VOLUME = 'lingomusic-volume'
export const SETTINGS_KEY_TRANSCODE_AAC_TO_MP3_320 = 'lingomusic-transcode-aac-to-mp3-320'
export const SETTINGS_KEY_TRANSCODE_AAC_TO_MP4 = 'lingomusic-transcode-aac-to-mp4'
export const SETTINGS_KEY_TRANSCODE_AAC_TO_AAC_STANDARD = 'lingomusic-transcode-aac-to-aac-standard'
export const SETTINGS_KEY_TRANSCODE_ALAC_TO_FLAC = 'lingomusic-transcode-alac-to-flac'
export const SETTINGS_KEY_TRANSCODE_ALAC_TO_WAV = 'lingomusic-transcode-alac-to-wav'
export const SETTINGS_KEY_TRANSCODE_ALAC_TO_MP4 = 'lingomusic-transcode-alac-to-mp4'
export const SETTINGS_KEY_INIT_GUIDE_DISMISSED = 'lingomusic-init-guide-dismissed'
export const SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART = 'lingomusic-skip-wrapper-autostart'

// 支持自由切换的音频元数据地区预设列表
export const METADATA_REGION_PRESETS = [
  { label: '中国大陆(简体中文)', value: 'cn' },
  { label: '中国香港(繁体中文)', value: 'hk' },
  { label: '中国台湾(繁体中文)', value: 'tw' },
  { label: '日本(日语)', value: 'jp' },
  { label: '韩国(韩语)', value: 'kr' },
  { label: '美国(英语)', value: 'us' },
  { label: '英国(英语)', value: 'gb' },
  { label: '新加坡(英语)', value: 'sg' },
  { label: '澳大利亚(英语)', value: 'au' },
  { label: '加拿大(英语)', value: 'ca' },
  { label: '德国(德语)', value: 'de' },
  { label: '法国(法语)', value: 'fr' },
  { label: '西班牙(西班牙语)', value: 'es' },
  { label: '意大利(意大利语)', value: 'it' },
  { label: '巴西(葡萄牙语)', value: 'br' },
  { label: '俄罗斯(俄语)', value: 'ru' },
  { label: '马来西亚(马来语)', value: 'my' },
  { label: '泰国(泰语)', value: 'th' },
  { label: '越南(越南语)', value: 'vn' },
  { label: '印度尼西亚(印尼语)', value: 'id' },
  { label: '墨西哥(西班牙语)', value: 'mx' },
  { label: '荷兰(荷兰语)', value: 'nl' },
  { label: '葡萄牙(葡萄牙语)', value: 'pt' },
  { label: '印度(英语)', value: 'in' },
  { label: '菲律宾(英语)', value: 'ph' },
  { label: '土耳其(土耳其语)', value: 'tr' },
  { label: '沙特阿拉伯(阿拉伯语)', value: 'sa' },
  { label: '阿联酋(阿拉伯语)', value: 'ae' },
]

// 首次启动协议与免责声明段落
export const INIT_AGREEMENT_PARAGRAPHS = [
  '欢迎使用LingoMusicDownloader。本软件用于个人学习与技术研究，不构成任何商业服务或平台义务承诺。',
  '在继续使用前，请您完整阅读并理解本协议、免责声明和风险提示。点击“同意并下一页”即视为您已确认并接受全部条款。',
  '1. 合法合规使用：您承诺仅在法律法规允许的范围内使用本软件，不得用于盗版传播、非法牟利、批量侵权分发等行为。',
  '2. 账号与凭据责任：您自行提供并管理账号登录信息、Cookies与相关认证信息。因凭据泄露、过期、共享导致的风险由您自行承担。',
  '3. 版权与内容权属：通过本软件检索或下载的音视频、封面、歌词等内容，其著作权及相关权利归原权利人所有。',
  '4. 删除与留存义务：若您所在地区法律、平台条款或权利人要求限制留存，您应及时删除相关内容，并承担相应责任。',
  '5. 服务可用性声明：本软件依赖第三方网络环境、系统组件与接口能力，可能出现中断、波动、失效或兼容性问题。',
  '6. 风险提示：使用过程中可能出现账号风控、访问受限、授权失效、下载失败、系统资源占用等情况，请您自行评估并接受风险。',
  '7. 组件安装声明：启用高级能力可能需要安装WSL2与Wrapper服务。该步骤可能占用磁盘空间并涉及额外登录流程。',
  '8. 数据与隐私：本软件不会主动上传您的本地媒体文件，但您应知悉系统日志、缓存与临时文件可能在本地留存。',
  '9. 免责边界：开发者对因使用本软件导致的任何直接或间接损失（含账号、版权、业务、设备损失）不承担赔偿责任。',
  '10. 用户独立责任：您理解并同意，所有下载、播放、转码、分享等操作均由您独立决定并承担全部法律后果。',
  '11. 第三方条款优先：当平台服务条款、地区法规与本协议存在冲突时，以更严格的条款与适用法律为准。',
  '12. 协议更新：本协议可能随版本调整而更新。继续使用新版本功能即视为接受更新后的条款。',
  '若您不同意上述任何条款，请点击“不同意并退出”立即停止使用本软件。',
]


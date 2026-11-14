// AboutView组件
import { Badge, Button, Card, IconButton, Segmented } from '../ui/components'
import { Box, Divider, Grid, HStack, Heading, Icon, Text, VStack } from '../ui/primitives'
import logoImage from '../assets/lingomusiclogo-sm.png'
import type { AppStore } from '../app/useAppStore'

// AboutView组件渲染入口
export function AboutView({ store }: { store: AppStore }) {
  const {
    disclaimerLang, openExternalLink, repositoryUrl, setDisclaimerLang,
  } = store

  return (
    <VStack gap="normal">

      {/* Product Info Section */}
      <Card>
        <VStack align="center" gap="normal" style={{ paddingBlock: '12px' }}>
          <img src={logoImage} alt="Product Logo" style={{ width: '72px', height: '72px' }} />
          <VStack align="center" gap={4}>
            <Heading level={3}>LingoMusic Downloader</Heading>
            <Text tone="secondary" style={{ fontSize: '0.88rem' }}>版本号: v2.1.0-Beta (Vite+React+Tauri)</Text>
          </VStack>
          <Text style={{ fontSize: '0.88rem', textAlign: 'center', maxWidth: '480px', lineHeight: '1.5' }}>
            本应用是一个极速高保真的本地音视频抓取客户端，支持全自动高级品质音频解密与智能封面歌词合成封装。
          </Text>
          <HStack gap="compact" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => openExternalLink(`${repositoryUrl}/releases`, 'GitHub Releases')}
            >
              检查更新
            </Button>
            <Badge tone="default">后端监听: 8000</Badge>
            <Badge tone="default">解密端口: 10020</Badge>
            <Badge tone="default">画质解密: 20020</Badge>
          </HStack>
        </VStack>
      </Card>

      {/* Author section */}
      <Card>
        <HStack justify="space-between" align="center">
          <VStack gap={2}>
            <Text weight={700}>开发作者</Text>
            <Text tone="secondary" style={{ fontSize: '0.84rem' }}>yourpapayouknow (GitHub 社区)</Text>
          </VStack>
          <IconButton
            variant="ghost"
            onClick={() => openExternalLink(repositoryUrl, 'GitHub 仓库')}
            title="作者仓库"
          >
            <Icon name="github" size={20} />
          </IconButton>
        </HStack>
      </Card>

      {/* Third-party references */}
      <Card>
        <VStack gap="compact">
          <Text weight={700}>第三方开源项目引用</Text>
          <Grid minItemWidth="230px" gap="compact" style={{ marginTop: '8px' }}>
            {[
              { name: 'Tauri Framework', desc: '轻量级桌面容器核心', url: 'https://github.com/tauri-apps/tauri' },
              { name: 'Vite Build Engine', desc: '下一代前端构建调度器', url: 'https://github.com/vitejs/vite' },
              { name: 'React UI Runtime', desc: '高性能状态组件库', url: 'https://github.com/facebook/react' },
              { name: 'FastAPI Backend', desc: '极速异步 Python API 框架', url: 'https://github.com/tiangolo/fastapi' },
              { name: 'gamdl Downloader', desc: '核心曲目调度抓取模块', url: 'https://github.com/glomatico/gamdl' }
            ].map((lib, i) => (
              <Box key={i} surface border padding="compact" radius="container">
                <HStack justify="space-between" align="center">
                  <VStack gap={2} style={{ minWidth: 0 }}>
                    <Text weight={600} style={{ fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lib.name}
                    </Text>
                    <Text tone="secondary" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lib.desc}
                    </Text>
                  </VStack>
                  <IconButton
                    variant="ghost"
                    size={28}
                    onClick={() => openExternalLink(lib.url, lib.name)}
                    title="查看主页"
                  >
                    <Icon name="link" size={13} />
                  </IconButton>
                </HStack>
              </Box>
            ))}
          </Grid>
        </VStack>
      </Card>

      {/* Legal Disclaimer Section */}
      <Card style={{ border: '1px solid var(--system-error)', background: 'rgba(232, 17, 35, 0.03)' }}>
        <VStack gap="normal">
          <HStack justify="space-between" align="center">
            <HStack gap="compact" align="center">
              <Icon name="alert" size={18} style={{ color: 'var(--system-error)' }} />
              <Text weight={700} tone="error">使用免责声明及法律风险提示</Text>
            </HStack>
            <HStack gap="compact" align="center">
              <Text style={{ fontSize: '0.78rem' }} tone="secondary">语言/Language:</Text>
              <Segmented
                options={[
                  { label: '中文', value: 'zh' },
                  { label: 'EN', value: 'en' }
                ]}
                value={disclaimerLang}
                onChange={(val) => setDisclaimerLang(val as 'zh' | 'en')}
              />
            </HStack>
          </HStack>

          <Divider style={{ borderColor: 'color-mix(in srgb, var(--system-error) 20%, transparent)' }} />

          {disclaimerLang === 'zh' ? (
            <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ marginBlock: '0 6px' }}>1. 本软件为开源学习交流项目，仅限用于个人技术交流与研究目的。<b>严禁将本软件用于任何商业性牟利或非法侵权行为。</b></p>
              <p style={{ marginBlock: '6px' }}>2. 软件中所调用的音视频解密辅助接口及 WSL 环境，均来源自网络公共研究文献。本软件不提供任何音源版权破解，亦不存储任何受版权保护的音视频文件。</p>
              <p style={{ marginBlock: '6px' }}>3. 用户利用本应用检索或下载的所有音乐、歌词、唱片封面和 MV 视频内容，<b>版权均归原版权方合法所有。</b>请于下载后 24 小时内将其全部删除。</p>
              <p style={{ marginBlock: '6px 0' }}>4. 因使用本软件所产生的账号封禁、数字版权纠纷、民事侵权或刑事纠纷风险，<b>均由使用者个人自行承担全部责任</b>，软件作者和开发团队不承担任何连带赔偿与法律责任。</p>
            </div>
          ) : (
            <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ marginBlock: '0 6px' }}>1. This software is an open-source educational project for research and technical exploration. <b>Any commercial usage or infringement is strictly prohibited.</b></p>
              <p style={{ marginBlock: '6px' }}>2. The decryption helper and proxy configurations are based on public network research. This tool does not directly host, crack, or bypass digital rights ownerships.</p>
              <p style={{ marginBlock: '6px' }}>3. All ownership rights for audio/video materials fetched by this client <b>belong to the original legal rights holders.</b> Please delete files within 24 hours of retrieval.</p>
              <p style={{ marginBlock: '6px 0' }}>4. Risk of account suspension, copyright enforcement, civil liability, or damages <b>falls entirely upon the individual user.</b> The developers assume no legal responsibility or liability.</p>
            </div>
          )}
        </VStack>
      </Card>
    </VStack>
  )
}

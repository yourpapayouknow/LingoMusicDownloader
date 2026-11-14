// 关于页视图
import { useState } from '../head'
import { Btn, Crd, Dlg, IcBtn, Seg } from '../ui/components'
import { Grd, HStk, Hdg, Icn, Img, Txt, VStk } from '../ui/primitives'
import logoImage from '../assets/logo.svg'
import type { AppStore } from '../app/useAppStore'

// 本地服务端口信息
const PORTS = [
  { name: '后端服务', value: '8000', hint: '本地接口服务端口' },
  { name: '解密服务', value: '10020', hint: '音频解密服务端口' },
  { name: '画质服务', value: '20020', hint: 'MV画质解密服务端口' },
]

// 开源依赖致谢列表
const LIBS = [
  { name: 'Tauri', desc: '桌面容器', url: 'https://github.com/tauri-apps/tauri' },
  { name: 'React', desc: '前端界面框架', url: 'https://github.com/facebook/react' },
  { name: 'Vite', desc: '前端构建工具', url: 'https://github.com/vitejs/vite' },
  { name: 'FastAPI', desc: '后端接口框架', url: 'https://github.com/tiangolo/fastapi' },
  { name: 'gamdl', desc: '下载核心', url: 'https://github.com/glomatico/gamdl' },
  { name: 'MingCute Icons', desc: '界面图标库', url: 'https://github.com/mingcute-design/mingcute-icons' },
]

// 关于页渲染入口
export function AbtVw({ store }: { store: AppStore }) {
  const { disclaimerLang, opnext, repositoryUrl, setDisclaimerLang } = store
  const [legalOpen, setLegalOpen] = useState(false)

  return (
    <VStk gap="normal">
      {/* 产品信息 */}
      <Crd>
        <VStk align="center" gap="normal" style={{ paddingBlock: '12px' }}>
          <Img
            src={logoImage}
            alt="LingoMusic Logo"
            radius={15}
            style={{ width: '96px', height: '96px', boxShadow: 'var(--soft-shadow)' }}
          />
          <VStk align="center" gap={4}>
            <Hdg level={3}>LingoMusic Downloader</Hdg>
            <Txt tone="secondary" style={{ fontSize: '0.88rem' }}>版本 {__APP_VERSION__}</Txt>
          </VStk>
          <Txt
            style={{ fontSize: '0.9rem' }}
            title="Apple Music高保真下载器，支持无损音频、MV与本地播放"
          >
            Apple Music高保真下载器
          </Txt>
          <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>作者 yourpapayouknow</Txt>
          <HStk gap="compact" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Btn
              variant="secondary"
              size="sm"
              leadingIcon={<Icn name="download" size={14} />}
              onClick={() => opnext(`${repositoryUrl}/releases`, 'GitHub Releases')}
            >
              查看更新
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              leadingIcon={<Icn name="github" size={14} />}
              onClick={() => opnext(repositoryUrl, 'GitHub仓库')}
            >
              GitHub仓库
            </Btn>
            <Btn
              variant="ghost"
              size="sm"
              leadingIcon={<Icn name="link" size={14} />}
              onClick={() => opnext(`${repositoryUrl}/blob/main/LICENSE`, 'MIT许可证')}
            >
              MIT许可证
            </Btn>
          </HStk>
        </VStk>
      </Crd>

      {/* 本地服务端口 */}
      <Crd>
        <VStk gap="compact">
          <Txt weight={700}>本地服务</Txt>
          <Grd minItemWidth="180px" gap="normal" style={{ marginTop: '4px' }}>
            {PORTS.map((item) => (
              <VStk key={item.name} gap={2} title={item.hint}>
                <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>{item.name}</Txt>
                <Txt weight={700} style={{ fontSize: '1rem' }}>{item.value}</Txt>
              </VStk>
            ))}
          </Grd>
        </VStk>
      </Crd>

      {/* 开源致谢 */}
      <Crd>
        <VStk gap="compact">
          <Txt weight={700}>开源致谢</Txt>
          <VStk gap={0}>
            {LIBS.map((lib, index) => (
              <HStk
                key={lib.name}
                justify="space-between"
                align="center"
                gap="compact"
                style={{
                  paddingBlock: '10px',
                  borderTop: index > 0
                    ? '1px solid color-mix(in srgb, var(--component-wrapped-bg) 24%, transparent)'
                    : undefined,
                }}
              >
                <HStk gap="compact" align="center" style={{ minWidth: 0 }}>
                  <Txt weight={600} style={{ fontSize: '0.84rem', whiteSpace: 'nowrap' }}>{lib.name}</Txt>
                  <Txt tone="secondary" style={{ fontSize: '0.76rem', whiteSpace: 'nowrap' }}>{lib.desc}</Txt>
                </HStk>
                <IcBtn
                  variant="ghost"
                  size={28}
                  onClick={() => opnext(lib.url, lib.name)}
                  title="查看主页"
                >
                  <Icn name="link" size={13} />
                </IcBtn>
              </HStk>
            ))}
          </VStk>
        </VStk>
      </Crd>

      {/* 法律声明入口 */}
      <Crd style={{ border: '1px solid var(--system-error)', background: 'rgba(232, 17, 35, 0.03)' }}>
        <HStk justify="space-between" align="center" gap="normal">
          <HStk gap="compact" align="center">
            <Icn name="alert" size={18} style={{ color: 'var(--system-error)' }} />
            <Txt weight={700} tone="error" style={{ whiteSpace: 'nowrap' }}>使用声明</Txt>
            <Txt tone="secondary" style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
              仅供个人学习研究，禁止商业或侵权用途。
            </Txt>
          </HStk>
          <Btn variant="ghost" size="sm" onClick={() => setLegalOpen(true)}>
            查看完整声明
          </Btn>
        </HStk>
      </Crd>

      {/* 完整法律声明弹窗 */}
      <Dlg
        open={legalOpen}
        title="使用声明"
        confirmText="关闭"
        hideCancel
        onOpenChange={(open) => setLegalOpen(open)}
        onConfirm={() => setLegalOpen(false)}
      >
        <VStk gap="normal">
          <HStk justify="flex-end" align="center" gap="compact">
            <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>语言</Txt>
            <Seg
              options={[
                { label: '中文', value: 'zh' },
                { label: '英文', value: 'en' },
              ]}
              value={disclaimerLang}
              onChange={(val) => setDisclaimerLang(val as 'zh' | 'en')}
            />
          </HStk>
          <div
            style={{
              maxHeight: '50vh',
              overflowY: 'auto',
              paddingRight: '4px',
              fontSize: '0.8rem',
              lineHeight: '1.6',
              color: 'var(--text-secondary)',
            }}
          >
            {disclaimerLang === 'zh' ? (
              <>
                <p style={{ marginBlock: '0 6px' }}>1. 本软件为开源学习交流项目，仅限用于个人技术交流与研究目的。<b>严禁将本软件用于任何商业性牟利或非法侵权行为。</b></p>
                <p style={{ marginBlock: '6px' }}>2. 软件中所调用的音视频解密辅助接口及WSL环境，均来源自网络公共研究文献。本软件不提供任何音源版权破解，亦不存储任何受版权保护的音视频文件。</p>
                <p style={{ marginBlock: '6px' }}>3. 用户利用本应用检索或下载的所有音乐、歌词、唱片封面和MV视频内容，<b>版权均归原版权方合法所有。</b>请于下载后24小时内将其全部删除。</p>
                <p style={{ marginBlock: '6px 0' }}>4. 因使用本软件所产生的账号封禁、数字版权纠纷、民事侵权或刑事纠纷风险，<b>均由使用者个人自行承担全部责任</b>，软件作者和开发团队不承担任何连带赔偿与法律责任。</p>
              </>
            ) : (
              <>
                <p style={{ marginBlock: '0 6px' }}>1. This software is an open-source educational project for research and technical exploration. <b>Any commercial usage or infringement is strictly prohibited.</b></p>
                <p style={{ marginBlock: '6px' }}>2. The decryption helper and proxy configurations are based on public network research. This tool does not directly host, crack, or bypass digital rights ownerships.</p>
                <p style={{ marginBlock: '6px' }}>3. All ownership rights for audio/video materials fetched by this client <b>belong to the original legal rights holders.</b> Please delete files within 24 hours of retrieval.</p>
                <p style={{ marginBlock: '6px 0' }}>4. Risk of account suspension, copyright enforcement, civil liability, or damages <b>falls entirely upon the individual user.</b> The developers assume no legal responsibility or liability.</p>
              </>
            )}
          </div>
        </VStk>
      </Dlg>
    </VStk>
  )
}
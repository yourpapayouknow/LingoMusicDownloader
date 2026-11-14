// AboutView组件
import { Bdg, Btn, Crd, IcBtn, Seg } from '../ui/components'
import { Bx, Dvd, Grd, HStk, Hdg, Icn, Txt, VStk } from '../ui/primitives'
import logoImage from '../assets/lingomusiclogo-sm.png'
import type { AppStore } from '../app/useAppStore'

// AboutView组件渲染入口
export function AbtVw({ store }: { store: AppStore }) {
  const {
    disclaimerLang, opnext, repositoryUrl, setDisclaimerLang,
  } = store

  return (
    <VStk gap="normal">

      {/* Product Info Section */}
      <Crd>
        <VStk align="center" gap="normal" style={{ paddingBlock: '12px' }}>
          <img src={logoImage} alt="Product Logo" style={{ width: '72px', height: '72px' }} />
          <VStk align="center" gap={4}>
            <Hdg level={3}>LingoMusic Downloader</Hdg>
            <Txt tone="secondary" style={{ fontSize: '0.88rem' }}>版本号: v{__APP_VERSION__} (Vite+React+Tauri)</Txt>
          </VStk>
          <Txt style={{ fontSize: '0.88rem', textAlign: 'center', maxWidth: '480px', lineHeight: '1.5' }}>
            本应用是一个极速高保真的本地音视频抓取客户端，支持全自动高级品质音频解密与智能封面歌词合成封装。
          </Txt>
          <HStk gap="compact" style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
            <Btn
              variant="secondary"
              size="sm"
              onClick={() => opnext(`${repositoryUrl}/releases`, 'GitHub Releases')}
            >
              查看更新
            </Btn>
            <Bdg tone="default">后端监听: 8000</Bdg>
            <Bdg tone="default">解密端口: 10020</Bdg>
            <Bdg tone="default">画质解密: 20020</Bdg>
          </HStk>
        </VStk>
      </Crd>

      {/* Author section */}
      <Crd>
        <HStk justify="space-between" align="center">
          <VStk gap={2}>
            <Txt weight={700}>开发作者</Txt>
            <Txt tone="secondary" style={{ fontSize: '0.84rem' }}>yourpapayouknow (GitHub 社区)</Txt>
          </VStk>
          <IcBtn
            variant="ghost"
            onClick={() => opnext(repositoryUrl, 'GitHub 仓库')}
            title="作者仓库"
          >
            <Icn name="github" size={20} />
          </IcBtn>
        </HStk>
      </Crd>

      {/* Third-party references */}
      <Crd>
        <VStk gap="compact">
          <Txt weight={700}>第三方开源项目引用</Txt>
          <Grd minItemWidth="230px" gap="compact" style={{ marginTop: '8px' }}>
            {[
              { name: 'Tauri Framework', desc: '轻量级桌面容器核心', url: 'https://github.com/tauri-apps/tauri' },
              { name: 'Vite Build Engine', desc: '下一代前端构建调度器', url: 'https://github.com/vitejs/vite' },
              { name: 'React UI Runtime', desc: '高性能状态组件库', url: 'https://github.com/facebook/react' },
              { name: 'FastAPI Backend', desc: '极速异步 Python API 框架', url: 'https://github.com/tiangolo/fastapi' },
              { name: 'gamdl Downloader', desc: '核心曲目调度抓取模块', url: 'https://github.com/glomatico/gamdl' }
            ].map((lib, i) => (
              <Bx key={i} padding="compact">
                <HStk justify="space-between" align="center">
                  <VStk gap={2} style={{ minWidth: 0 }}>
                    <Txt weight={600} style={{ fontSize: '0.84rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lib.name}
                    </Txt>
                    <Txt tone="secondary" style={{ fontSize: '0.74rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {lib.desc}
                    </Txt>
                  </VStk>
                  <IcBtn
                    variant="ghost"
                    size={28}
                    onClick={() => opnext(lib.url, lib.name)}
                    title="查看主页"
                  >
                    <Icn name="link" size={13} />
                  </IcBtn>
                </HStk>
              </Bx>
            ))}
          </Grd>
        </VStk>
      </Crd>

      {/* Legal Disclaimer Section */}
      <Crd style={{ border: '1px solid var(--system-error)', background: 'rgba(232, 17, 35, 0.03)' }}>
        <VStk gap="normal">
          <HStk justify="space-between" align="center">
            <HStk gap="compact" align="center">
              <Icn name="alert" size={18} style={{ color: 'var(--system-error)' }} />
              <Txt weight={700} tone="error">使用免责声明及法律风险提示</Txt>
            </HStk>
            <HStk gap="compact" align="center">
              <Txt style={{ fontSize: '0.78rem' }} tone="secondary">语言/Language:</Txt>
              <Seg
                options={[
                  { label: '中文', value: 'zh' },
                  { label: 'EN', value: 'en' }
                ]}
                value={disclaimerLang}
                onChange={(val) => setDisclaimerLang(val as 'zh' | 'en')}
              />
            </HStk>
          </HStk>

          <Dvd style={{ borderColor: 'color-mix(in srgb, var(--system-error) 20%, transparent)' }} />

          {disclaimerLang === 'zh' ? (
            <div style={{ fontSize: '0.8rem', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
              <p style={{ marginBlock: '0 6px' }}>1. 本软件为开源学习交流项目，仅限用于个人技术交流与研究目的。<b>严禁将本软件用于任何商业性牟利或非法侵权行为。</b></p>
              <p style={{ marginBlock: '6px' }}>2. 软件中所调用的音视频解密辅助接口及WSL环境，均来源自网络公共研究文献。本软件不提供任何音源版权破解，亦不存储任何受版权保护的音视频文件。</p>
              <p style={{ marginBlock: '6px' }}>3. 用户利用本应用检索或下载的所有音乐、歌词、唱片封面和MV视频内容，<b>版权均归原版权方合法所有。</b>请于下载后 24 小时内将其全部删除。</p>
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
        </VStk>
      </Crd>
    </VStk>
  )
}

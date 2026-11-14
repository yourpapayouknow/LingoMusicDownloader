// 设置页视图
import { METADATA_REGION_PRESETS } from '../app/constants'
import { SetSec } from '../components/SetSec'
import { Bdg, Btn, Mnu, Spn, TxAr, Tgl } from '../ui/components'
import { Bx, Dvd, Grd, HStk, Icn, Txt, VStk } from '../ui/primitives'
import type { AppStore } from '../app/useAppStore'

// 设置页渲染入口
export function SetVw({ store }: { store: AppStore }) {
  const {
    accordionOpen, codec, cookieSaving, cookieText, downloaderInitialized, hdlopn, healthStatus,
    initCookieConfigured, initWrapperConfigured, setlge, metadataRegion, resolution, setCodec,
    setCookieText, setMetadataRegion, setResolution, setTranscodeAacToAacStandard,
    setTranscodeAacToMp3_320, setTranscodeAacToMp4, setTranscodeAlacToFlac, setTranscodeAlacToMp4,
    setTranscodeAlacToWav, setwrpenb, skipWrapperAutostart, terminalLogs, tglacd,
    transcodeAacToAacStandard, transcodeAacToMp3_320, transcodeAacToMp4, transcodeAlacToFlac,
    transcodeAlacToMp4, transcodeAlacToWav, trgsvck, useWrapper,
    opnwsld, opnwrpd, wslInstallStatusData, wrapperSetupStatusData,
  } = store

  return (
    <VStk gap="normal">
      <SetSec id="status" title="运行状态信息" open={accordionOpen.status} onToggle={tglacd}>
        <Grd minItemWidth="240px" gap="normal">
          <Bx padding="normal">
            <VStk gap={4}>
              <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>授权文件Cookies.txt</Txt>
              <HStk justify="space-between" align="center" style={{ marginTop: '4px' }}>
                <Txt weight={700}>{healthStatus?.cookies_ok ? '有效配置' : '未授权 (请贴Cookies)'}</Txt>
                <Bdg tone={healthStatus?.cookies_ok ? 'success' : 'error'}>
                  {healthStatus?.cookies_ok ? '正常' : '异常'}
                </Bdg>
              </HStk>
            </VStk>
          </Bx>
          <Bx padding="normal">
            <VStk gap={4}>
              <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>解密辅助代理 (Wrapper)</Txt>
              <HStk justify="space-between" align="center" style={{ marginTop: '4px' }}>
                <Txt weight={700}>{healthStatus?.wrapper.all_ok ? '解密容器就绪' : '组件未工作'}</Txt>
                <Bdg tone={healthStatus?.wrapper.all_ok ? 'success' : 'error'}>
                  {healthStatus?.wrapper.all_ok ? '已连接' : '未启动'}
                </Bdg>
              </HStk>
            </VStk>
          </Bx>
          <Bx padding="normal">
            <VStk gap={4}>
              <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>本地调度中心进程</Txt>
              <HStk justify="space-between" align="center" style={{ marginTop: '4px' }}>
                <Txt weight={700}>{downloaderInitialized ? '核心就绪' : '等待接口'}</Txt>
                <Bdg tone={downloaderInitialized ? 'success' : 'error'}>
                  {downloaderInitialized ? '运行中' : '异常'}
                </Bdg>
              </HStk>
            </VStk>
          </Bx>
          <Bx padding="normal">
            <VStk gap={4}>
              <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>解析曲库首选地区</Txt>
              <HStk justify="space-between" align="center" style={{ marginTop: '4px' }}>
                <Txt weight={700}>
                  {metadataRegion === 'auto'
                    ? '跟随账号'
                    : (METADATA_REGION_PRESETS.find((item) => item.value === metadataRegion)?.label || metadataRegion.toUpperCase())}
                </Txt>
                <Bdg tone="default">{metadataRegion === 'auto' ? '默认' : '自定义'}</Bdg>
              </HStk>
            </VStk>
          </Bx>
          </Grd>
        <HStk
          justify="space-between"
          align="center"
          gap="normal"
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 26%, transparent)',
          }}
        >
          <VStk gap={2}>
            <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>安装任务</Txt>
            <Txt weight={700} style={{ fontSize: '0.8rem' }}>
              WSL2: {wslInstallStatusData?.running ? '运行中' : wslInstallStatusData?.completed ? (wslInstallStatusData.success_flag ? '已完成' : '失败') : '空闲'}
              {' · '}
              Wrapper: {wrapperSetupStatusData?.awaiting_input ? '等待输入' : wrapperSetupStatusData?.running ? '运行中' : wrapperSetupStatusData?.completed ? (wrapperSetupStatusData.success_flag ? '已完成' : '失败') : '空闲'}
            </Txt>
          </VStk>
          <HStk gap="compact">
            <Btn variant="secondary" size="sm" onClick={() => void opnwsld()}>
              安装WSL2
            </Btn>
            <Btn variant="secondary" size="sm" onClick={() => void opnwrpd()}>
              安装Wrapper
            </Btn>
            {(wslInstallStatusData?.running || wrapperSetupStatusData?.running || wrapperSetupStatusData?.awaiting_input) && (
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (wslInstallStatusData?.running) void opnwsld()
                  else void opnwrpd()
                }}
              >
                查看进度
              </Btn>
            )}
          </HStk>
        </HStk>
      </SetSec>

      <SetSec
        id="onboarding"
        title="初始化页面入口"
        hint="重新查看协议、Cookies登录或Wrapper初始化引导"
        open={accordionOpen.onboarding}
        onToggle={tglacd}
      >
        <HStk justify="space-between" align="center" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <HStk gap="compact" align="center" style={{ flexWrap: 'wrap' }}>
            <Bdg tone={initCookieConfigured ? 'success' : 'error'}>
              Cookies: {initCookieConfigured ? '已配置' : '未配置'}
            </Bdg>
            <Bdg tone={initWrapperConfigured ? 'success' : 'default'}>
              Wrapper: {initWrapperConfigured ? '已配置' : '未配置'}
            </Bdg>
            <Bdg tone={skipWrapperAutostart ? 'default' : 'info'}>
              自启: {skipWrapperAutostart ? '已跳过' : '默认开启'}
            </Bdg>
          </HStk>
          <Btn onClick={hdlopn}>打开初始化页面</Btn>
        </HStk>
      </SetSec>

      <SetSec
        id="quality"
        title="音频品质选择"
        hint="高品音质需要Wrapper就绪；未就绪时提交下载会直接报错"
        open={accordionOpen.quality}
        onToggle={tglacd}
      >
        <VStk gap="normal">
          <HStk justify="space-between" align="center">
            <Txt weight={700} style={{ fontSize: '0.94rem' }} title="启用无损/全景声下载">高品音质下载</Txt>
            <Tgl
              checked={useWrapper}
              onChange={(e) => setwrpenb(e.target.checked)}
              disabled={healthStatus ? !healthStatus.wrapper.all_ok : true}
              title="若Wrapper未就绪，提交下载时将直接报错，不再自动降级"
            />
          </HStk>

          <Dvd />

          <Mnu
            label="设定默认音频下载音质"
            disabled={!useWrapper}
            value={codec}
            onChange={(e) => setCodec(e.target.value)}
            options={[
              { label: 'AAC 256kbps (标准立体声)', value: 'aac-legacy' },
              { label: 'ALAC 24-bit/192kHz (高保真无损品质)', value: 'alac' },
              { label: 'Dolby Atmos (杜比全景声 环绕声)', value: 'atmos' }
            ]}
          />

          <Dvd />

          <Mnu
            label="设定默认MV视频画质"
            disabled={healthStatus ? !healthStatus.wrapper.all_ok : true}
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            options={healthStatus?.wrapper.all_ok ? [
              { label: '1080p FHD (自适应高画质)', value: '1080p' },
              { label: '4K Ultra HD (极高清品质)', value: '4k' }
            ] : [
              { label: '不可用 (请开启本地解密辅助代理)', value: 'unavailable' }
            ]}
          />

          <Dvd />

          <Mnu
            label="设定音频元数据地区"
            title="默认跟随账号地区，也可自由切换其他地区下载元数据"
            value={metadataRegion}
            onChange={(e) => setMetadataRegion(e.target.value)}
            options={[
              {
                label: healthStatus?.account_storefront
                  ? `跟随账号(${healthStatus.account_storefront.toUpperCase()})`
                  : '跟随账号地区',
                value: 'auto',
              },
              ...METADATA_REGION_PRESETS,
            ]}
          />

          <Dvd />

          <VStk gap="compact">
            <Txt weight={700} style={{ fontSize: '0.94rem' }} title="不建议使用AAC转MP3，这将导致音质永久损失">
              通用音频格式转码
            </Txt>

            <HStk justify="space-between" align="center">
              <Txt style={{ fontSize: '0.84rem' }}>AAC自动转换320kMP3</Txt>
              <Tgl checked={transcodeAacToMp3_320} onChange={(e) => setTranscodeAacToMp3_320(e.target.checked)} />
            </HStk>
            <HStk justify="space-between" align="center">
              <Txt style={{ fontSize: '0.84rem' }}>AAC自动转换MP4</Txt>
              <Tgl checked={transcodeAacToMp4} onChange={(e) => setTranscodeAacToMp4(e.target.checked)} />
            </HStk>
            <HStk justify="space-between" align="center">
              <Txt style={{ fontSize: '0.84rem' }}>AAC自动转换标准AAC</Txt>
              <Tgl checked={transcodeAacToAacStandard} onChange={(e) => setTranscodeAacToAacStandard(e.target.checked)} />
            </HStk>
            <HStk justify="space-between" align="center">
              <Txt style={{ fontSize: '0.84rem' }}>ALAC自动转换FLAC</Txt>
              <Tgl checked={transcodeAlacToFlac} onChange={(e) => setTranscodeAlacToFlac(e.target.checked)} />
            </HStk>
            <HStk justify="space-between" align="center">
              <Txt style={{ fontSize: '0.84rem' }}>ALAC自动转换WAV</Txt>
              <Tgl checked={transcodeAlacToWav} onChange={(e) => setTranscodeAlacToWav(e.target.checked)} />
            </HStk>
            <HStk justify="space-between" align="center">
              <Txt style={{ fontSize: '0.84rem' }}>ALAC自动转换MP4</Txt>
              <Tgl checked={transcodeAlacToMp4} onChange={(e) => setTranscodeAlacToMp4(e.target.checked)} />
            </HStk>
          </VStk>
        </VStk>
      </SetSec>

      <SetSec id="cookie" title="Cookies授权管理" open={accordionOpen.cookie} onToggle={tglacd}>
        <VStk gap="normal">
          <TxAr
            placeholder="在此粘贴您的账户Cookies (Netscape 文本格式，首行应为 # Netscape HTTP Cookie File)..."
            value={cookieText}
            onChange={(e) => setCookieText(e.target.value)}
            style={{ height: '140px', fontSize: '0.8rem' }}
          />
          <HStk justify="flex-end">
            <Btn
              onClick={trgsvck}
              disabled={cookieSaving || !cookieText.trim()}
              leadingIcon={cookieSaving ? <Spn size={14} /> : <Icn name="check" size={14} />}
            >
              {cookieSaving ? '保存核心中...' : '保存并重启下载核心'}
            </Btn>
          </HStk>
        </VStk>
      </SetSec>

      <SetSec id="logs" title="运行日志与后台终端输出" open={accordionOpen.logs} onToggle={tglacd}>
        <div className="terminal-log-view">
          {terminalLogs.map((log, i) => (
            <div key={i} style={{ marginBottom: '3px' }}>{log}</div>
          ))}
          <div ref={setlge} />
        </div>
      </SetSec>
    </VStk>
  )
}
// SettingsView组件
import { METADATA_REGION_PRESETS } from '../app/constants'
import { Badge, Button, Menu, Spinner, TextArea, Toggle } from '../ui/components'
import { Box, Divider, Grid, HStack, Icon, Text, VStack } from '../ui/primitives'
import type { AppStore } from '../app/useAppStore'

// SettingsView组件渲染入口
export function SettingsView({ store }: { store: AppStore }) {
  const {
    accordionOpen, codec, cookieSaving, cookieText, downloaderInitialized, handleOpenInitGuideFromSettings, healthStatus, initCookieConfigured, initWrapperConfigured, setLogsEndEl, metadataRegion, resolution, setCodec, setCookieText, setMetadataRegion, setResolution, setTranscodeAacToAacStandard, setTranscodeAacToMp3_320, setTranscodeAacToMp4, setTranscodeAlacToFlac, setTranscodeAlacToMp4, setTranscodeAlacToWav, setUseWrapper, skipWrapperAutostart, terminalLogs, toggleAccordion, transcodeAacToAacStandard, transcodeAacToMp3_320, transcodeAacToMp4, transcodeAlacToFlac, transcodeAlacToMp4, transcodeAlacToWav, triggerSaveCookies, useWrapper,
  } = store

  return (
    <VStack gap="normal">
      {/* STATUS Accordion */}
      <Box surface border radius="container" style={{ overflow: 'hidden' }}>
        <button
          className="ui-accordion-summary"
          style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
          onClick={() => toggleAccordion('status')}
        >
          <Text weight={700}>运行状态信息</Text>
          <Icon name="chevronDown" style={{ transform: accordionOpen.status ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {accordionOpen.status && (
          <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
            <Grid minItemWidth="200px" gap="normal">
              <Box padding="normal" surface border radius="container">
                <VStack gap={4}>
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>授权文件 Cookies.txt</Text>
                  <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                    <Text weight={700}>{healthStatus?.cookies_ok ? '有效配置' : '未授权 (请贴Cookies)'}</Text>
                    <Badge tone={healthStatus?.cookies_ok ? 'success' : 'error'}>
                      {healthStatus?.cookies_ok ? '正常' : '异常'}
                    </Badge>
                  </HStack>
                </VStack>
              </Box>
              <Box padding="normal" surface border radius="container">
                <VStack gap={4}>
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>解密辅助代理 (Wrapper)</Text>
                  <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                    <Text weight={700}>{healthStatus?.wrapper.all_ok ? '解密容器就绪' : '组件未工作'}</Text>
                    <Badge tone={healthStatus?.wrapper.all_ok ? 'success' : 'error'}>
                      {healthStatus?.wrapper.all_ok ? '已连接' : '未启动'}
                    </Badge>
                  </HStack>
                </VStack>
              </Box>
              <Box padding="normal" surface border radius="container">
                <VStack gap={4}>
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>本地调度中心进程</Text>
                  <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                    <Text weight={700}>{downloaderInitialized ? '核心就绪' : '等待接口'}</Text>
                    <Badge tone={downloaderInitialized ? 'success' : 'error'}>
                      {downloaderInitialized ? '运行中' : '异常'}
                    </Badge>
                  </HStack>
                </VStack>
              </Box>
              <Box padding="normal" surface border radius="container">
                <VStack gap={4}>
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>解析曲库首选地区</Text>
                  <HStack justify="space-between" align="center" style={{ marginTop: '4px' }}>
                    <Text weight={700}>中国大陆 (CN)</Text>
                    <Badge tone="default">默认</Badge>
                  </HStack>
                </VStack>
              </Box>
            </Grid>
          </div>
        )}
      </Box>

      {/* ONBOARDING ENTRY Accordion */}
      <Box surface border radius="container" style={{ overflow: 'hidden' }}>
        <button
          className="ui-accordion-summary"
          style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
          onClick={() => toggleAccordion('onboarding')}
        >
          <Text weight={700}>初始化页面入口</Text>
          <Icon name="chevronDown" style={{ transform: accordionOpen.onboarding ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {accordionOpen.onboarding && (
          <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
            <VStack gap="normal">
              <Text tone="secondary" style={{ fontSize: '0.8rem', lineHeight: '1.6' }}>
                如需重新查看协议、重新执行 Cookies 登录或 Wrapper 初始化引导，可在此重新打开首次启动初始化页面。
              </Text>
              <HStack justify="space-between" align="center" style={{ flexWrap: 'wrap', gap: '10px' }}>
                <HStack gap="compact" align="center" style={{ flexWrap: 'wrap' }}>
                  <Badge tone={initCookieConfigured ? 'success' : 'error'}>
                    Cookies: {initCookieConfigured ? '已配置' : '未配置'}
                  </Badge>
                  <Badge tone={initWrapperConfigured ? 'success' : 'default'}>
                    Wrapper: {initWrapperConfigured ? '已配置' : '未配置'}
                  </Badge>
                  <Badge tone={skipWrapperAutostart ? 'default' : 'info'}>
                    自启: {skipWrapperAutostart ? '已跳过' : '默认开启'}
                  </Badge>
                </HStack>
                <Button onClick={handleOpenInitGuideFromSettings}>
                  打开初始化页面
                </Button>
              </HStack>
            </VStack>
          </div>
        )}
      </Box>

      {/* QUALITY Accordion */}
      <Box surface border radius="container" style={{ overflow: 'hidden' }}>
        <button
          className="ui-accordion-summary"
          style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
          onClick={() => toggleAccordion('quality')}
        >
          <Text weight={700}>音视频品质品质选择</Text>
          <Icon name="chevronDown" style={{ transform: accordionOpen.quality ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {accordionOpen.quality && (
          <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
            <VStack gap="normal">
              <HStack justify="space-between" align="center">
                <VStack gap={2}>
                  <Text weight={700} style={{ fontSize: '0.94rem' }}>启用高品音质下载 (无损/全景声)</Text>
                  <Text tone="secondary" style={{ fontSize: '0.78rem' }}>若Wrapper未就绪，提交下载时将直接报错，不再自动降级</Text>
                </VStack>
                <Toggle
                  checked={useWrapper}
                  onChange={(e) => setUseWrapper(e.target.checked)}
                  disabled={healthStatus ? !healthStatus.wrapper.all_ok : true}
                />
              </HStack>

              <Divider />

              <Menu
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

              <Divider />

              <Menu
                label="设定默认 MV 视频画质"
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

              <Divider />

              <Menu
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

              <Divider />

              <VStack gap="compact">
                <Text weight={700} style={{ fontSize: '0.94rem' }}>通用音频格式转码</Text>
                <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                  不建议使用AAC转MP3，这将导致音质永久损失。
                </Text>

                <HStack justify="space-between" align="center">
                  <Text style={{ fontSize: '0.84rem' }}>AAC自动转换320kMP3</Text>
                  <Toggle checked={transcodeAacToMp3_320} onChange={(e) => setTranscodeAacToMp3_320(e.target.checked)} />
                </HStack>
                <HStack justify="space-between" align="center">
                  <Text style={{ fontSize: '0.84rem' }}>AAC自动转换MP4</Text>
                  <Toggle checked={transcodeAacToMp4} onChange={(e) => setTranscodeAacToMp4(e.target.checked)} />
                </HStack>
                <HStack justify="space-between" align="center">
                  <Text style={{ fontSize: '0.84rem' }}>AAC自动转换标准AAC</Text>
                  <Toggle checked={transcodeAacToAacStandard} onChange={(e) => setTranscodeAacToAacStandard(e.target.checked)} />
                </HStack>
                <HStack justify="space-between" align="center">
                  <Text style={{ fontSize: '0.84rem' }}>ALAC自动转换FLAC</Text>
                  <Toggle checked={transcodeAlacToFlac} onChange={(e) => setTranscodeAlacToFlac(e.target.checked)} />
                </HStack>
                <HStack justify="space-between" align="center">
                  <Text style={{ fontSize: '0.84rem' }}>ALAC自动转换WAV</Text>
                  <Toggle checked={transcodeAlacToWav} onChange={(e) => setTranscodeAlacToWav(e.target.checked)} />
                </HStack>
                <HStack justify="space-between" align="center">
                  <Text style={{ fontSize: '0.84rem' }}>ALAC自动转换MP4</Text>
                  <Toggle checked={transcodeAlacToMp4} onChange={(e) => setTranscodeAlacToMp4(e.target.checked)} />
                </HStack>
              </VStack>
            </VStack>
          </div>
        )}
      </Box>

      {/* COOKIE Accordion */}
      <Box surface border radius="container" style={{ overflow: 'hidden' }}>
        <button
          className="ui-accordion-summary"
          style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
          onClick={() => toggleAccordion('cookie')}
        >
          <Text weight={700}>Cookies 授权管理</Text>
          <Icon name="chevronDown" style={{ transform: accordionOpen.cookie ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {accordionOpen.cookie && (
          <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
            <VStack gap="normal">
              <TextArea
                placeholder="在此粘贴您的账户 Cookies (Netscape 文本格式，首行应为 # Netscape HTTP Cookie File)..."
                value={cookieText}
                onChange={(e) => setCookieText(e.target.value)}
                style={{ height: '140px', fontSize: '0.8rem' }}
              />
              <HStack justify="flex-end">
                <Button
                  onClick={triggerSaveCookies}
                  disabled={cookieSaving || !cookieText.trim()}
                  leadingIcon={cookieSaving ? <Spinner size={14} /> : <Icon name="check" size={14} />}
                >
                  {cookieSaving ? '保存核心中...' : '保存并重启下载核心'}
                </Button>
              </HStack>
            </VStack>
          </div>
        )}
      </Box>

      {/* LOGS Accordion */}
      <Box surface border radius="container" style={{ overflow: 'hidden' }}>
        <button
          className="ui-accordion-summary"
          style={{ width: '100%', background: 'transparent', border: 'none', textAlign: 'left' }}
          onClick={() => toggleAccordion('logs')}
        >
          <Text weight={700}>运行日志与后台终端输出</Text>
          <Icon name="chevronDown" style={{ transform: accordionOpen.logs ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
        {accordionOpen.logs && (
          <div style={{ padding: '16px', borderTop: '1px solid color-mix(in srgb, var(--component-wrapped-bg) 30%, transparent)' }}>
            <div className="terminal-log-view">
              {terminalLogs.map((log, i) => (
                <div key={i} style={{ marginBottom: '3px' }}>{log}</div>
              ))}
              <div ref={setLogsEndEl} />
            </div>
          </div>
        )}
      </Box>
    </VStack>
  )
}

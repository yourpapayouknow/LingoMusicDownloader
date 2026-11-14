// WrapperDialog组件
import { INIT_AGREEMENT_PARAGRAPHS, SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART } from '../../app/constants'
import { Badge, Button, IconButton, Spinner, TextField } from '../../ui/components'
import { Box, HStack, Heading, Icon, Text, VStack } from '../../ui/primitives'
import { svstngs } from '../../utils/api'
import type { AppStore } from '../../app/useAppStore'

// WrapperDialog组件渲染入口
export function WrapperDialog({ store }: { store: AppStore }) {
  const {
    dismissInitGuide, handleCloseWrapperSetupDialog, handleConfirmStartWrapperSetup, handleDisagreeAndExit, handleInitCookieLogin, handleInitEnterSoftware, handleRestartWrapperSetup, handleSubmitWrapperInput, initAgreementReachedEnd, setInitScrollEl, initCookieConfigured, initCookieLoggingIn, initEnterConfirmOpen, initGuideOpen, initGuideStep, initWrapperConfigured, openWrapperSetupDialog, openWslInstallDialog, pushToast, setInitEnterConfirmOpen, setInitGuideStep, setSkipWrapperAutostart, setWrapperInput2fa, setWrapperInputAppleId, setWrapperInputPassword, wrapperInput2fa, wrapperInputAppleId, wrapperInputDialogOpen, wrapperInputPassword, wrapperInputSubmitting, wrapperSetupDialogOpen, wrapperSetupLoading, wrapperSetupPrecheck, wrapperSetupStatusData,
  } = store

  return (
    <>
      {/* Wrapper installer/login dialog */}
      {wrapperSetupDialogOpen && (
        <div className="wsl-install-mask" role="dialog" aria-modal="true" aria-label="安装Wrapper并登录">
          <div className="wsl-install-card">
            <VStack gap="normal" style={{ height: '100%' }}>
              <HStack justify="space-between" align="flex-start">
                <VStack gap={4}>
                  <Heading level={3}>安装Wrapper并登录</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                    将自动检测WSL2、安装/启动Wrapper，并在需要时提示输入ID/密码与2FA验证码
                  </Text>
                </VStack>
                <IconButton
                  variant="ghost"
                  size={30}
                  onClick={handleCloseWrapperSetupDialog}
                  disabled={wrapperSetupStatusData?.running}
                  title={wrapperSetupStatusData?.running ? '任务进行中，暂不可关闭' : '关闭'}
                >
                  <Icon name="close" size={14} />
                </IconButton>
              </HStack>

              <Box surface border radius="container" padding="normal">
                <VStack gap={6}>
                  <Text style={{ fontSize: '0.82rem' }}>
                    预检查结果：{wrapperSetupPrecheck?.message || '正在检查WSL2与Wrapper运行条件...'}
                  </Text>
                  {wrapperSetupStatusData?.message && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      当前状态：{wrapperSetupStatusData.message}（阶段：{wrapperSetupStatusData.stage || 'idle'}）
                    </Text>
                  )}
                  <HStack gap="compact" style={{ flexWrap: 'wrap' }}>
                    <Badge tone={wrapperSetupPrecheck?.wsl2_installed ? 'success' : 'error'}>
                      WSL2: {wrapperSetupPrecheck?.wsl2_installed ? '已安装' : '未安装'}
                    </Badge>
                    <Badge tone={wrapperSetupPrecheck?.wrapper_installed ? 'success' : 'default'}>
                      Wrapper: {wrapperSetupPrecheck?.wrapper_installed ? '已安装' : '未安装'}
                    </Badge>
                    <Badge tone={wrapperSetupPrecheck?.wrapper_running ? 'success' : 'error'}>
                      服务: {wrapperSetupPrecheck?.wrapper_running ? '运行中' : '未运行'}
                    </Badge>
                    <Badge tone={wrapperSetupPrecheck?.session_db_exists ? 'success' : 'default'}>
                      会话库: {wrapperSetupPrecheck?.session_db_exists ? '已存在' : '未检测到'}
                    </Badge>
                  </HStack>
                  {wrapperSetupPrecheck?.wsl2_hint && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      WSL2检测依据：{wrapperSetupPrecheck.wsl2_hint}
                    </Text>
                  )}
                  {wrapperSetupStatusData?.awaiting_input && (
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      输入提示：{wrapperSetupStatusData.input_prompt || '检测到Wrapper需要输入，请在弹窗中提交。'}
                    </Text>
                  )}
                </VStack>
              </Box>

              {(wrapperSetupStatusData?.logs?.length || 0) > 0 && (
                <div className="wsl-install-log-panel">
                  {wrapperSetupStatusData?.logs?.map((line, index) => (
                    <div key={`wrapper-log-${index}`}>{line}</div>
                  ))}
                </div>
              )}

              {wrapperSetupLoading && (
                <HStack gap="compact" align="center">
                  <Spinner size={14} />
                  <Text tone="secondary" style={{ fontSize: '0.8rem' }}>
                    正在处理Wrapper流程，请稍候...
                  </Text>
                </HStack>
              )}

              <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                <Button
                  variant="secondary"
                  onClick={handleCloseWrapperSetupDialog}
                  disabled={wrapperSetupStatusData?.running}
                >
                  关闭
                </Button>
                <HStack gap="compact" align="center">
                  <Button
                    variant="secondary"
                    onClick={handleRestartWrapperSetup}
                    disabled={
                      wrapperSetupLoading
                      || wrapperSetupStatusData?.running
                      || !wrapperSetupPrecheck?.can_start
                    }
                  >
                    重启Wrapper
                  </Button>
                  <Button
                    className="init-guide-primary-btn"
                    onClick={handleConfirmStartWrapperSetup}
                    disabled={
                      wrapperSetupLoading
                      || wrapperSetupStatusData?.running
                      || !wrapperSetupPrecheck?.can_start
                    }
                    leadingIcon={wrapperSetupLoading ? <Spinner size={14} /> : undefined}
                  >
                    {wrapperSetupStatusData?.running ? '处理中...' : '开始安装/登录'}
                  </Button>
                </HStack>
              </HStack>
            </VStack>

            {wrapperInputDialogOpen && (
              <div className="wrapper-input-mask">
                <div className="wrapper-input-card">
                  <VStack gap="normal">
                    <VStack gap={4}>
                      <Heading level={4}>
                        {wrapperSetupStatusData?.input_type === '2fa' ? '输入2FA验证码' : '输入Apple ID登录信息'}
                      </Heading>
                      <Text tone="secondary" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                        {wrapperSetupStatusData?.input_prompt || '检测到Wrapper正在等待输入，请完成提交。'}
                      </Text>
                    </VStack>

                    {wrapperSetupStatusData?.input_type === '2fa' ? (
                      <TextField
                        placeholder="请输入验证码"
                        value={wrapperInput2fa}
                        onChange={(e) => setWrapperInput2fa(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitWrapperInput()}
                      />
                    ) : (
                      <VStack gap="compact">
                        <TextField
                          placeholder="请输入Apple ID（邮箱）"
                          value={wrapperInputAppleId}
                          onChange={(e) => setWrapperInputAppleId(e.target.value)}
                        />
                        <TextField
                          type="password"
                          placeholder="请输入Apple ID密码"
                          value={wrapperInputPassword}
                          onChange={(e) => setWrapperInputPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSubmitWrapperInput()}
                        />
                      </VStack>
                    )}

                    <HStack justify="flex-end" gap="compact">
                      <Button
                        className="init-guide-primary-btn"
                        onClick={handleSubmitWrapperInput}
                        disabled={wrapperInputSubmitting}
                        leadingIcon={wrapperInputSubmitting ? <Spinner size={14} /> : undefined}
                      >
                        提交
                      </Button>
                    </HStack>
                  </VStack>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Forced onboarding wizard (frontend-only for now) */}
      {initGuideOpen && (
        <div className="init-guide-overlay" role="dialog" aria-modal="true" aria-label="首次启动引导">
          <div className="init-guide-backdrop" />
          <div className="init-guide-modal">
            {initGuideStep === 1 ? (
              <VStack gap="normal" style={{ height: '100%' }}>
                <VStack gap={4}>
                  <Heading level={3}>欢迎使用LingoMusicDownloader！</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    请完整阅读以下协议与免责声明，滚动至末尾后方可继续下一步。
                  </Text>
                </VStack>

                <div className="init-guide-agreement-scroll" ref={setInitScrollEl}>
                  {INIT_AGREEMENT_PARAGRAPHS.map((paragraph, index) => (
                    <p key={`agreement-${index}`}>{paragraph}</p>
                  ))}
                </div>

                <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                  <Button
                    variant="secondary"
                    onClick={handleDisagreeAndExit}
                  >
                    不同意并退出
                  </Button>
                  <Button
                    className="init-guide-primary-btn"
                    onClick={() => setInitGuideStep(2)}
                    disabled={!initAgreementReachedEnd}
                  >
                    同意并下一页
                  </Button>
                </HStack>
              </VStack>
            ) : (
              <VStack gap="normal" style={{ height: '100%' }}>
                <VStack gap={4}>
                  <Heading level={3}>软件初始化配置</Heading>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    以下步骤用于激活全部核心功能。Cookies与Wrapper流程均支持自动检测、安装与登录引导。
                  </Text>
                </VStack>

                <div className="init-guide-step-block">
                  <Text weight={700} style={{ fontSize: '0.95rem' }}>获取Cookies</Text>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    使用Cookies登录以激活搜索与AAC下载功能
                  </Text>
                  <HStack align="center" gap="compact" style={{ marginTop: '10px' }}>
                    <Button
                      className="init-guide-primary-btn"
                      onClick={handleInitCookieLogin}
                      leadingIcon={initCookieLoggingIn ? <Spinner size={14} /> : undefined}
                    >
                      {initCookieLoggingIn ? '完成登录并继续' : '点击登录'}
                    </Button>
                    {initCookieConfigured && (
                      <span className="init-guide-check-ok" title="已配置">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </HStack>
                </div>

                <div className="init-guide-step-block">
                  <Text weight={700} style={{ fontSize: '0.95rem' }}>安装Wrapper</Text>
                  <Text tone="secondary" style={{ fontSize: '0.82rem' }}>
                    使用Wrapper以激活ALAC/DOLBY与MV等高级下载功能
                  </Text>
                  <HStack align="center" gap="compact" style={{ marginTop: '10px', flexWrap: 'wrap' }}>
                    <Button
                      className="init-guide-primary-btn"
                      onClick={openWslInstallDialog}
                    >
                      点击安装WSL2
                    </Button>
                    <Button
                      className="init-guide-primary-btn"
                      onClick={openWrapperSetupDialog}
                    >
                      点击安装Wrapper并登录
                    </Button>
                    {initWrapperConfigured && (
                      <span className="init-guide-check-ok" title="已配置">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </HStack>
                  <VStack gap={6} style={{ marginTop: '10px', alignItems: 'flex-start' }}>
                    <HStack gap={6} align="flex-start">
                      <Icon name="alert" size={14} style={{ marginTop: '2px', color: '#f6a11b' }} />
                      <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                        1. 不安装以上组件，仍然可有限使用本软件。
                      </Text>
                    </HStack>
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      2. WSL2将默认安装在D盘并占用15GB左右空间，请提前预留空间。
                    </Text>
                    <Text tone="secondary" style={{ fontSize: '0.78rem' }}>
                      3. Wrapper为独立服务，使用时需要为其再次登录ID。
                    </Text>
                  </VStack>
                </div>

                <HStack justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                  <Button variant="secondary" onClick={() => setInitGuideStep(1)}>
                    上一页
                  </Button>
                  <Button className="init-guide-primary-btn" onClick={handleInitEnterSoftware}>
                    进入软件
                  </Button>
                </HStack>

                {initEnterConfirmOpen && (
                  <div className="init-guide-confirm-mask">
                    <div className="init-guide-confirm-card">
                      <VStack gap="normal">
                        <HStack gap="compact" align="center">
                          <Icon name="alert" size={16} style={{ color: '#f6a11b' }} />
                          <Text weight={700}>提示</Text>
                        </HStack>
                        <Text style={{ fontSize: '0.84rem', lineHeight: '1.6' }}>
                          未配置Wrapper将无法下载无损等高规格音视频！您可后续在设置页配置。
                        </Text>
                        <HStack justify="flex-end" gap="compact">
                          <Button variant="secondary" onClick={() => setInitEnterConfirmOpen(false)}>
                            返回
                          </Button>
                          <Button
                            className="init-guide-primary-btn"
                            onClick={() => {
                              setInitEnterConfirmOpen(false)
                              setSkipWrapperAutostart(true)
                              localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, 'true')
                              svstngs({ [SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART]: 'true' }).catch(console.error)
                              pushToast('已跳过Wrapper配置', '后续可在设置中随时配置与启动', 'info')
                              dismissInitGuide()
                            }}
                          >
                            仍然进入
                          </Button>
                        </HStack>
                      </VStack>
                    </div>
                  </div>
                )}
              </VStack>
            )}
          </div>
        </div>
      )}
    </>
  )
}

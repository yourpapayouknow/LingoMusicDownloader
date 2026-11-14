// WrapperDialog组件
import { useEffect, useRef } from '../../head'
import { INIT_AGREEMENT_PARAGRAPHS, SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART } from '../../app/constants'
import { Bdg, Btn, IcBtn, Spn, TxFld } from '../../ui/components'
import { Bx, HStk, Hdg, Icn, Txt, VStk } from '../../ui/primitives'
import { svstngs } from '../../utils/api'
import { stglbl } from '../../app/helpers'
import type { AppStore } from '../../app/useAppStore'

// WrapperDialog组件渲染入口
export function WrpDlg({ store }: { store: AppStore }) {
  const {
    dsmsgd, hdlclwd, hdlcfws, hdlsgn, hdlckl, hdlent, hdlrsws, hdlswrp, initAgreementReachedEnd, setisc, initCookieConfigured, initCookieLoggingIn, initEnterConfirmOpen, initGuideOpen, initGuideStep, initWrapperConfigured, opnwrpd, opnwsld, pshtst, setInitEnterConfirmOpen, setInitGuideStep, setSkipWrapperAutostart, setWrapperInput2fa, setWrapperInputAppleId, setWrapperInputPassword, wrapperInput2fa, wrapperInputAppleId, wrapperInputDialogOpen, wrapperInputPassword, wrapperInputSubmitting, wrapperSetupDialogOpen, wrapperSetupLoading, wrapperSetupPrecheck, wrapperSetupStatusData,
  } = store

  const wrpRef = useRef<HTMLDivElement>(null)
  const initRef = useRef<HTMLDivElement>(null)

  // Wrapper弹窗打开时聚焦并支持Esc后台关闭
  useEffect(() => {
    if (!wrapperSetupDialogOpen) return
    wrpRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hdlclwd()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [wrapperSetupDialogOpen, hdlclwd])

  // 初始化向导打开时聚焦
  useEffect(() => {
    if (initGuideOpen) initRef.current?.focus()
  }, [initGuideOpen])

  return (
    <>
      {/* Wrapper installer/login dialog */}
      {wrapperSetupDialogOpen && (
        <div className="wsl-install-mask" role="dialog" aria-modal="true" aria-label="安装解密组件并登录">
          <div className="wsl-install-card" ref={wrpRef} tabIndex={-1} style={{ outline: 'none' }}>
            <VStk gap="normal" style={{ height: '100%' }}>
              <HStk justify="space-between" align="flex-start">
                <VStk gap={4}>
                  <Hdg level={3}>安装解密组件并登录</Hdg>
                  <Txt tone="secondary" style={{ fontSize: '0.82rem', lineHeight: '1.5' }}>
                    将自动检测WSL2、安装/启动解密组件，并在需要时提示输入账号/密码与两步验证码
                  </Txt>
                </VStk>
                <IcBtn
                  variant="ghost"
                  size={30}
                  onClick={hdlclwd}
                  title={wrapperSetupStatusData?.running ? '后台运行' : '关闭'}
                >
                  <Icn name="close" size={14} />
                </IcBtn>
              </HStk>

              <Bx surface border radius="container" padding="normal">
                <VStk gap={6}>
                  <Txt style={{ fontSize: '0.82rem' }}>
                    预检查结果：{wrapperSetupPrecheck?.message || '正在检查WSL2与解密组件运行条件...'}
                  </Txt>
                  {wrapperSetupStatusData?.message && (
                    <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                      当前状态：{wrapperSetupStatusData.message}（阶段：{stglbl(wrapperSetupStatusData.stage || 'idle')}）
                    </Txt>
                  )}
                  <HStk gap="compact" style={{ flexWrap: 'wrap' }}>
                    <Bdg tone={wrapperSetupPrecheck?.wsl2_installed ? 'success' : 'error'}>
                      WSL2: {wrapperSetupPrecheck?.wsl2_installed ? '已安装' : '未安装'}
                    </Bdg>
                    <Bdg tone={wrapperSetupPrecheck?.wrapper_installed ? 'success' : 'default'}>
                      Wrapper: {wrapperSetupPrecheck?.wrapper_installed ? '已安装' : '未安装'}
                    </Bdg>
                    <Bdg tone={wrapperSetupPrecheck?.wrapper_running ? 'success' : 'error'}>
                      服务: {wrapperSetupPrecheck?.wrapper_running ? '运行中' : '未运行'}
                    </Bdg>
                    <Bdg tone={wrapperSetupPrecheck?.session_db_exists ? 'success' : 'default'}>
                      会话库: {wrapperSetupPrecheck?.session_db_exists ? '已存在' : '未检测到'}
                    </Bdg>
                  </HStk>
                  {wrapperSetupPrecheck?.wsl2_hint && (
                    <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                      WSL2检测依据：{wrapperSetupPrecheck.wsl2_hint}
                    </Txt>
                  )}
                  {wrapperSetupStatusData?.awaiting_input && (
                    <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                      输入提示：{wrapperSetupStatusData.input_prompt || '检测到解密组件需要输入，请在弹窗中提交。'}
                    </Txt>
                  )}
                </VStk>
              </Bx>

              {(wrapperSetupStatusData?.logs?.length || 0) > 0 && (
                <div className="wsl-install-log-panel">
                  {wrapperSetupStatusData?.logs?.map((line, index) => (
                    <div key={`wrapper-log-${index}`}>{line}</div>
                  ))}
                </div>
              )}

              {wrapperSetupLoading && (
                <HStk gap="compact" align="center">
                  <Spn size={14} />
                  <Txt tone="secondary" style={{ fontSize: '0.8rem' }}>
                    正在处理解密组件流程，请稍候...
                  </Txt>
                </HStk>
              )}

              <HStk justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                <Btn variant="secondary" onClick={hdlclwd}>
                  {wrapperSetupStatusData?.running || wrapperSetupStatusData?.awaiting_input ? '后台运行' : '关闭'}
                </Btn>
                <HStk gap="compact" align="center">
                  <Btn
                    variant="secondary"
                    onClick={hdlrsws}
                    disabled={
                      wrapperSetupLoading
                      || wrapperSetupStatusData?.running
                      || !wrapperSetupPrecheck?.can_start
                    }
                  >
                    重启解密组件
                  </Btn>
                  <Btn
                    className="init-guide-primary-btn"
                    onClick={hdlcfws}
                    disabled={
                      wrapperSetupLoading
                      || wrapperSetupStatusData?.running
                      || !wrapperSetupPrecheck?.can_start
                    }
                    leadingIcon={wrapperSetupLoading ? <Spn size={14} /> : undefined}
                  >
                    {wrapperSetupStatusData?.running ? '处理中...' : '开始安装/登录'}
                  </Btn>
                </HStk>
              </HStk>
            </VStk>

            {wrapperInputDialogOpen && (
              <div className="wrapper-input-mask">
                <div className="wrapper-input-card">
                  <VStk gap="normal">
                    <VStk gap={4}>
                      <Hdg level={4}>
                        {wrapperSetupStatusData?.input_type === '2fa' ? '输入两步验证码' : '输入Apple ID登录信息'}
                      </Hdg>
                      <Txt tone="secondary" style={{ fontSize: '0.8rem', lineHeight: '1.5' }}>
                        {wrapperSetupStatusData?.input_prompt || '检测到解密组件正在等待输入，请完成提交。'}
                      </Txt>
                    </VStk>

                    {wrapperSetupStatusData?.input_type === '2fa' ? (
                      <TxFld
                        placeholder="请输入验证码"
                        value={wrapperInput2fa}
                        onChange={(e) => setWrapperInput2fa(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && hdlswrp()}
                      />
                    ) : (
                      <VStk gap="compact">
                        <TxFld
                          placeholder="请输入Apple ID（邮箱）"
                          value={wrapperInputAppleId}
                          onChange={(e) => setWrapperInputAppleId(e.target.value)}
                        />
                        <TxFld
                          type="password"
                          placeholder="请输入Apple ID密码"
                          value={wrapperInputPassword}
                          onChange={(e) => setWrapperInputPassword(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && hdlswrp()}
                        />
                      </VStk>
                    )}

                    <HStk justify="flex-end" gap="compact">
                      <Btn
                        className="init-guide-primary-btn"
                        onClick={hdlswrp}
                        disabled={wrapperInputSubmitting}
                        leadingIcon={wrapperInputSubmitting ? <Spn size={14} /> : undefined}
                      >
                        提交
                      </Btn>
                    </HStk>
                  </VStk>
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
          <div className="init-guide-modal" ref={initRef} tabIndex={-1} style={{ outline: 'none' }}>
            {initGuideStep === 1 ? (
              <VStk gap="normal" style={{ height: '100%' }}>
                <VStk gap={4}>
                  <Hdg level={3}>欢迎使用LingoMusicDownloader！</Hdg>
                  <Txt tone="secondary" style={{ fontSize: '0.82rem' }}>
                    请完整阅读以下协议与免责声明，滚动至末尾后方可继续下一步。
                  </Txt>
                </VStk>

                <div className="init-guide-agreement-scroll" ref={setisc}>
                  {INIT_AGREEMENT_PARAGRAPHS.map((paragraph, index) => (
                    <p key={`agreement-${index}`}>{paragraph}</p>
                  ))}
                </div>

                <HStk justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                  <Btn
                    variant="secondary"
                    onClick={hdlsgn}
                  >
                    不同意并退出
                  </Btn>
                  <Btn
                    className="init-guide-primary-btn"
                    onClick={() => setInitGuideStep(2)}
                    disabled={!initAgreementReachedEnd}
                  >
                    同意并下一页
                  </Btn>
                </HStk>
              </VStk>
            ) : (
              <VStk gap="normal" style={{ height: '100%' }}>
                <VStk gap={4}>
                  <Hdg level={3}>软件初始化配置</Hdg>
                  <Txt tone="secondary" style={{ fontSize: '0.82rem' }}>
                    以下步骤用于激活全部核心功能。登录凭据与解密组件流程均支持自动检测、安装与登录引导。
                  </Txt>
                </VStk>

                <div className="init-guide-step-block">
                  <Txt weight={700} style={{ fontSize: '0.95rem' }}>获取登录凭据</Txt>
                  <Txt tone="secondary" style={{ fontSize: '0.82rem' }}>
                    登录后激活搜索与AAC下载功能
                  </Txt>
                  <HStk align="center" gap="compact" style={{ marginTop: '10px' }}>
                    <Btn
                      className="init-guide-primary-btn"
                      onClick={hdlckl}
                      leadingIcon={initCookieLoggingIn ? <Spn size={14} /> : undefined}
                    >
                      {initCookieLoggingIn ? '完成登录并继续' : '点击登录'}
                    </Btn>
                    {initCookieConfigured && (
                      <span className="init-guide-check-ok" title="已配置">
                        <Icn name="check" size={12} />
                      </span>
                    )}
                  </HStk>
                </div>

                <div className="init-guide-step-block">
                  <Txt weight={700} style={{ fontSize: '0.95rem' }}>安装解密组件</Txt>
                  <Txt tone="secondary" style={{ fontSize: '0.82rem' }}>
                    启用解密组件以激活ALAC/杜比与MV等高级下载功能
                  </Txt>
                  <HStk align="center" gap="compact" style={{ marginTop: '10px', flexWrap: 'wrap' }}>
                    <Btn
                      className="init-guide-primary-btn"
                      onClick={opnwsld}
                    >
                      点击安装WSL2
                    </Btn>
                    <Btn
                      className="init-guide-primary-btn"
                      onClick={opnwrpd}
                    >
                      点击安装解密组件并登录
                    </Btn>
                    {initWrapperConfigured && (
                      <span className="init-guide-check-ok" title="已配置">
                        <Icn name="check" size={12} />
                      </span>
                    )}
                  </HStk>
                  <VStk gap={6} style={{ marginTop: '10px', alignItems: 'flex-start' }}>
                    <HStk gap={6} align="flex-start">
                      <Icn name="alert" size={14} style={{ marginTop: '2px', color: '#f6a11b' }} />
                      <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                        1. 不安装以上组件，仍然可有限使用本软件。
                      </Txt>
                    </HStk>
                    <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                      2. WSL2将默认安装在D盘并占用15GB左右空间，请提前预留空间。
                    </Txt>
                    <Txt tone="secondary" style={{ fontSize: '0.78rem' }}>
                      3. 解密组件为独立服务，使用时需要为其再次登录账号。
                    </Txt>
                  </VStk>
                </div>

                <HStk justify="space-between" align="center" style={{ marginTop: 'auto' }}>
                  <Btn variant="secondary" onClick={() => setInitGuideStep(1)}>
                    上一页
                  </Btn>
                  <Btn className="init-guide-primary-btn" onClick={hdlent}>
                    进入软件
                  </Btn>
                </HStk>

                {initEnterConfirmOpen && (
                  <div className="init-guide-confirm-mask">
                    <div className="init-guide-confirm-card">
                      <VStk gap="normal">
                        <HStk gap="compact" align="center">
                          <Icn name="alert" size={16} style={{ color: '#f6a11b' }} />
                          <Txt weight={700}>提示</Txt>
                        </HStk>
                        <Txt style={{ fontSize: '0.84rem', lineHeight: '1.6' }}>
                          未配置解密组件将无法下载无损等高规格音视频！您可后续在设置页配置。
                        </Txt>
                        <HStk justify="flex-end" gap="compact">
                          <Btn variant="secondary" onClick={() => setInitEnterConfirmOpen(false)}>
                            返回
                          </Btn>
                          <Btn
                            className="init-guide-primary-btn"
                            onClick={() => {
                              setInitEnterConfirmOpen(false)
                              setSkipWrapperAutostart(true)
                              localStorage.setItem(SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART, 'true')
                              svstngs({ [SETTINGS_KEY_SKIP_WRAPPER_AUTOSTART]: 'true' }).catch(console.error)
                              pshtst('已跳过解密组件配置', '后续可在设置中随时配置与启动', 'info')
                              dsmsgd()
                            }}
                          >
                            仍然进入
                          </Btn>
                        </HStk>
                      </VStk>
                    </div>
                  </div>
                )}
              </VStk>
            )}
          </div>
        </div>
      )}
    </>
  )
}

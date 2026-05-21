import { useCallback, useMemo, useState } from 'react'
import heroImage from './assets/hero.png'
import './app.css'
import { useTheme } from './theme/ThemeProvider'
import {
  Avatar,
  Box,
  Divider,
  Grid,
  Heading,
  HStack,
  Icon,
  Image,
  ScrollView,
  Spacer,
  Text,
  VStack,
  ZStack,
} from './ui/primitives'
import {
  Accordion,
  Badge,
  BottomBar,
  Button,
  Card,
  Checkbox,
  Chip,
  Dialog,
  Drawer,
  FAB,
  IconButton,
  Menu,
  ProgressBar,
  RadioGroup,
  Segmented,
  Skeleton,
  Slider,
  Spinner,
  Tabs,
  TextArea,
  TextField,
  ToastViewport,
  Toggle,
  TopAppBar,
  VirtualList,
  type ToastItem,
  type ToastTone,
} from './ui/components'

type BacklogItem = {
  title: string
  owner: string
  status: 'todo' | 'doing' | 'done'
}

const tabItems = [
  { label: '总览', value: 'overview' },
  { label: '动态', value: 'activity' },
  { label: '设置', value: 'settings' },
]

const segmentedItems = [
  { label: '看板', value: 'board' },
  { label: '日历', value: 'calendar' },
  { label: '时间线', value: 'timeline' },
]

const sprintMenuItems = [
  { label: '迭代 42', value: 's42' },
  { label: '迭代 43', value: 's43' },
  { label: '迭代 44', value: 's44' },
]

const priorityItems = [
  { label: 'P0 (最高)', value: 'P0' },
  { label: 'P1 (高)', value: 'P1' },
  { label: 'P2 (中)', value: 'P2' },
]

const bottomBarItems = [
  { value: 'home', label: '首页', icon: <Icon name="home" />, badge: 2 },
  { value: 'search', label: '搜索', icon: <Icon name="search" /> },
  { value: 'alerts', label: '提醒', icon: <Icon name="bell" />, badge: 5 },
  { value: 'profile', label: '我的', icon: <Icon name="user" /> },
]

const quickFilterItems = [
  { label: '全部', value: 'all' },
  { label: '待办', value: 'todo' },
  { label: '进行中', value: 'doing' },
  { label: '已完成', value: 'done' },
]

function createBacklog(): BacklogItem[] {
  const owners = ['林枫', '陈敏', '赵宇', '王珂', '李然', '周宁']
  const statuses: BacklogItem['status'][] = ['todo', 'doing', 'done']

  return Array.from({ length: 180 }, (_, index) => ({
    title: `任务 #${String(index + 1).padStart(3, '0')} - 跨端状态映射与组件对齐`,
    owner: owners[index % owners.length],
    status: statuses[index % statuses.length],
  }))
}

function toneByStatus(status: BacklogItem['status']): 'default' | 'info' | 'success' {
  if (status === 'done') {
    return 'success'
  }

  if (status === 'doing') {
    return 'info'
  }

  return 'default'
}

function labelByStatus(status: BacklogItem['status']): string {
  if (status === 'done') {
    return '已完成'
  }

  if (status === 'doing') {
    return '进行中'
  }

  return '待办'
}

function App() {
  const { mode, toggleMode } = useTheme()

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [segmented, setSegmented] = useState('board')
  const [selectedSprint, setSelectedSprint] = useState('s43')
  const [priority, setPriority] = useState('P1')
  const [projectName, setProjectName] = useState('统一跨端 UI 框架')
  const [description, setDescription] = useState('基于 design-tokens 构建 React、SwiftUI、Compose、WinUI 一致的组件行为与视觉语言。')
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [analyticsEnabled, setAnalyticsEnabled] = useState(true)
  const [accessChecked, setAccessChecked] = useState(true)
  const [betaChecked, setBetaChecked] = useState(false)
  const [betaIndeterminate, setBetaIndeterminate] = useState(true)
  const [progress, setProgress] = useState(62)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [activeBottom, setActiveBottom] = useState('home')
  const [filter, setFilter] = useState('all')
  const [searchKeyword, setSearchKeyword] = useState('')

  const backlog = useMemo(() => createBacklog(), [])

  const filteredBacklog = useMemo(() => {
    return backlog.filter((item) => {
      const matchedStatus = filter === 'all' || item.status === filter
      const matchedKeyword =
        searchKeyword.length === 0 ||
        item.title.toLowerCase().includes(searchKeyword.toLowerCase()) ||
        item.owner.toLowerCase().includes(searchKeyword.toLowerCase())
      return matchedStatus && matchedKeyword
    })
  }, [backlog, filter, searchKeyword])

  const pushToast = useCallback((title: string, description: string, tone: ToastTone = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, title, description, tone }])

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id))
    }, 3500)
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <div className="app-shell">
      <TopAppBar
        title="iwmeiUI React 中文示例"
        onMenu={() => setDrawerOpen(true)}
        actions={
          <>
            <Badge tone="info">{mode === 'dark' ? '深色' : '浅色'}</Badge>
            <Toggle checked={mode === 'dark'} onChange={toggleMode} label="深色模式" />
            <IconButton aria-label="打开设置" onClick={() => pushToast('设置已打开', '已加载基于 Token 的配置项。', 'success')}>
              <Icon name="settings" />
            </IconButton>
          </>
        }
      />

      <Drawer open={drawerOpen} title="组件导航" onClose={() => setDrawerOpen(false)}>
        <VStack gap="compact" className="drawer-content">
          <Button variant="ghost" onClick={() => setActiveTab('overview')} leadingIcon={<Icon name="home" size={16} />}>
            总览
          </Button>
          <Button variant="ghost" onClick={() => setActiveTab('activity')} leadingIcon={<Icon name="search" size={16} />}>
            动态
          </Button>
          <Button variant="ghost" onClick={() => setActiveTab('settings')} leadingIcon={<Icon name="settings" size={16} />}>
            设置
          </Button>
        </VStack>
      </Drawer>

      <ScrollView className="app-main">
        <VStack gap="loose" className="app-sections">
          <Card className="hero-card">
            <Grid minItemWidth="280px" gap="normal">
              <VStack gap="normal" align="flex-start">
                <Badge tone="success">Web / React</Badge>
                <Heading level={2}>基于 Token 的跨端组件体系</Heading>
                <Text tone="secondary">
                  这个示例将 `design-tokens.json` 与 `plan.md` 直接映射为可用的 React 组件系统，覆盖主题切换、表单录入、状态反馈、
                  导航骨架以及大数据列表虚拟化渲染。
                </Text>
                <HStack gap="compact" wrap>
                  <Button leadingIcon={<Icon name="plus" size={16} />} onClick={() => pushToast('草稿已保存', '组件映射草稿已保存成功。', 'success')}>
                    保存草稿
                  </Button>
                  <Button variant="secondary" onClick={() => setDialogOpen(true)}>
                    打开弹窗
                  </Button>
                  <Button variant="ghost" onClick={() => pushToast('部署已排队', 'Web 构建流水线已开始执行。', 'info')}>
                    加入部署队列
                  </Button>
                </HStack>
              </VStack>

              <ZStack className="hero-preview">
                <Image src={heroImage} alt="示意图" className="hero-image" />
                <Box wrapped padding="normal" radius="container" className="hero-wrapped-box">
                  <HStack gap="compact" align="center">
                    <Avatar name="陈敏" src="https://i.pravatar.cc/80?img=45" size={42} />
                    <VStack gap={4} align="flex-start">
                      <Text tone="wrapped" weight={700}>
                        陈敏
                      </Text>
                      <Text tone="wrapped">设计系统负责人</Text>
                    </VStack>
                  </HStack>
                </Box>
              </ZStack>
            </Grid>
          </Card>

          <Card>
            <VStack gap="normal">
              <HStack justify="space-between" align="center" wrap>
                <Heading level={3}>布局、导航与内容层</Heading>
                <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} />
              </HStack>

              <HStack gap="normal" wrap>
                <Segmented options={segmentedItems} value={segmented} onChange={setSegmented} />
                <Spacer />
                <Menu label="迭代周期" options={sprintMenuItems} value={selectedSprint} onChange={(event) => setSelectedSprint(event.target.value)} />
              </HStack>

              <Divider />

              {activeTab === 'overview' ? (
                <Grid minItemWidth="180px" gap="compact">
                  <Box surface border padding="normal" radius="container">
                    <VStack gap={8}>
                      <Text tone="secondary">原子组件</Text>
                      <Heading level={4}>23</Heading>
                      <Text>布局与内容基础能力</Text>
                    </VStack>
                  </Box>
                  <Box surface border padding="normal" radius="container">
                    <VStack gap={8}>
                      <Text tone="secondary">复合组件</Text>
                      <Heading level={4}>17</Heading>
                      <Text>表单、反馈与骨架组件</Text>
                    </VStack>
                  </Box>
                  <Box surface border padding="normal" radius="container">
                    <VStack gap={8}>
                      <Text tone="secondary">主题模式</Text>
                      <Heading level={4}>2</Heading>
                      <Text>浅色与深色，共享布局变量</Text>
                    </VStack>
                  </Box>
                </Grid>
              ) : null}

              {activeTab === 'activity' ? (
                <VStack gap="compact">
                  <HStack align="center" gap="compact">
                    <Spinner />
                    <Text>正在同步跨平台组件动态...</Text>
                  </HStack>
                  <ProgressBar value={progress} />
                  <Text tone="secondary">实时同步进度：{progress}%</Text>
                </VStack>
              ) : null}

              {activeTab === 'settings' ? (
                <Grid minItemWidth="220px" gap="compact">
                  <Toggle label="开启消息通知" checked={notificationsEnabled} onChange={(event) => setNotificationsEnabled(event.target.checked)} />
                  <Toggle label="开启使用分析" checked={analyticsEnabled} onChange={(event) => setAnalyticsEnabled(event.target.checked)} />
                  <RadioGroup label="优先级" name="priority" value={priority} options={priorityItems} onChange={setPriority} horizontal />
                </Grid>
              ) : null}
            </VStack>
          </Card>

          <Card>
            <Grid minItemWidth="280px" gap="normal">
              <VStack gap="normal">
                <Heading level={3}>录入与触发层</Heading>
                <TextField
                  label="项目名称"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  prefix={<Icon name="home" size={16} />}
                />
                <TextArea
                  label="项目说明"
                  value={description}
                  rows={4}
                  onChange={(event) => setDescription(event.target.value)}
                  error={description.length < 20 ? '请至少输入 20 个字符。' : undefined}
                />
                <Slider label="交付进度" min={0} max={100} step={1} value={progress} onChange={(event) => setProgress(Number(event.target.value))} />
                <HStack gap="compact" wrap>
                  <Checkbox label="生产权限" checked={accessChecked} onChange={(event) => setAccessChecked(event.target.checked)} />
                  <Checkbox
                    label="Beta 功能"
                    checked={betaChecked}
                    indeterminate={betaIndeterminate}
                    onChange={(event) => {
                      setBetaChecked(event.target.checked)
                      setBetaIndeterminate(false)
                    }}
                  />
                </HStack>
              </VStack>

              <VStack gap="normal">
                <Heading level={3}>反馈与状态层</Heading>
                <HStack gap="compact" align="center" wrap>
                  <Badge>默认</Badge>
                  <Badge tone="info">进行中</Badge>
                  <Badge tone="success">已完成</Badge>
                  <Badge tone="error">错误</Badge>
                </HStack>
                <Box surface border padding="normal" radius="container">
                  <VStack gap={8}>
                    <Skeleton height={14} width="55%" />
                    <Skeleton height={14} width="85%" />
                    <Skeleton height={14} width="65%" />
                  </VStack>
                </Box>
                <HStack gap="compact" wrap>
                  <Button
                    variant="secondary"
                    onClick={() => pushToast('后台任务已启动', '上传任务正在执行中。', 'info')}
                    leadingIcon={<Icon name="bell" size={16} />}
                  >
                    显示提示
                  </Button>
                  <Button variant="ghost" onClick={() => setDialogOpen(true)} leadingIcon={<Icon name="alert" size={16} />}>
                    确认操作
                  </Button>
                </HStack>
              </VStack>
            </Grid>
          </Card>

          <Card>
            <VStack gap="normal">
              <Heading level={3}>复杂数据展示层</Heading>

              <HStack gap="compact" wrap>
                {quickFilterItems.map((option) => (
                  <Chip key={option.value} selected={filter === option.value} onClick={() => setFilter(option.value)}>
                    {option.label}
                  </Chip>
                ))}
                <TextField
                  aria-label="搜索任务列表"
                  placeholder="搜索任务标题或负责人"
                  value={searchKeyword}
                  onChange={(event) => setSearchKeyword(event.target.value)}
                  prefix={<Icon name="search" size={16} />}
                />
              </HStack>

              <VirtualList
                items={filteredBacklog}
                rowHeight={58}
                height={320}
                renderItem={(item, index) => (
                  <HStack className="backlog-row" align="center" justify="space-between">
                    <HStack gap="compact" align="center">
                      <Text tone="secondary">#{String(index + 1).padStart(3, '0')}</Text>
                      <Text>{item.title}</Text>
                    </HStack>
                    <HStack gap="compact" align="center">
                      <Text tone="secondary">{item.owner}</Text>
                      <Badge tone={toneByStatus(item.status)}>{labelByStatus(item.status)}</Badge>
                    </HStack>
                  </HStack>
                )}
              />

              <Accordion
                items={[
                  {
                    title: '实现策略',
                    content: <Text tone="secondary">先做原子组件与 Token 映射，再补交互态，最后组合页面级骨架。</Text>,
                  },
                  {
                    title: '可访问性说明',
                    content: <Text tone="secondary">保留焦点高亮、语义标签和深浅主题下稳定的对比度。</Text>,
                  },
                  {
                    title: '性能说明',
                    content: <Text tone="secondary">长列表使用虚拟渲染，在保证视觉一致的同时控制渲染开销。</Text>,
                  },
                ]}
              />
            </VStack>
          </Card>
        </VStack>
      </ScrollView>

      <BottomBar items={bottomBarItems} active={activeBottom} onChange={setActiveBottom} />

      <FAB onClick={() => pushToast('快速创建', '已生成一个新的任务草稿。', 'success')} aria-label="创建任务">
        <Icon name="plus" size={22} />
      </FAB>

      <Dialog
        open={dialogOpen}
        title="确认发布这套组件吗？"
        description="发布后将把当前 React 版本作为其他平台实现的对齐基线。"
        confirmText="立即发布"
        cancelText="稍后再说"
        onOpenChange={setDialogOpen}
        onConfirm={() => pushToast('发布成功', 'React 基线组件已成功发布。', 'success')}
      />

      <ToastViewport items={toasts} onDismiss={removeToast} />
    </div>
  )
}

export default App

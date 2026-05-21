 # iwmeiUI跨平台底层映射全字典

此表格是整个架构的“施工蓝图”，将现代UI开发中能遇到的几乎所有组件，按照其**功能领域**进行了极其详尽的分类，并精准对齐了四大主流平台（Web / Apple / Android / Windows）最新推荐的**声明式原生API**。

------

### 🧱 1. 布局与容器层 (Layout & Structure)

*架构核心：这一层绝对不能带业务逻辑，只负责“把东西放到正确的位置”。*

| **统一 API 定义** | **功能与设计系统映射**                           | **🌐 Web (React)**        | **🍎 Apple (SwiftUI)**     | **🤖 Android (Compose)**           | **🪟 Windows (WinUI 3)**   |
| ----------------- | ------------------------------------------------ | ------------------------ | ------------------------- | --------------------------------- | ------------------------- |
| **`Box`**         | 单一容器。承载 `Tokens` 里的背景色、圆角、毛玻璃 | `<div>` / `section`      | `ZStack` 或直接用修饰符   | `Box`                             | `Border` / `Grid`         |
| **`HStack`**      | 水平线性排列，控制横向间距 (gap)                 | `flex-row` / `gap`       | `HStack`                  | `Row`                             | `StackPanel (Horizontal)` |
| **`VStack`**      | 垂直线性排列，控制纵向间距                       | `flex-col` / `gap`       | `VStack`                  | `Column`                          | `StackPanel (Vertical)`   |
| **`ZStack`**      | Z轴重叠布局 (绝对定位)                           | `position: absolute`     | `ZStack`                  | `Box` (无约束堆叠)                | `Grid` (同单元格堆叠)     |
| **`Grid`**        | 二维网格布局 (如照片墙、仪表盘)                  | `display: grid`          | `LazyVGrid` / `LazyHGrid` | `LazyVerticalGrid`                | `VariableSizedWrapGrid`   |
| **`ScrollView`**  | 可滚动的视口容器                                 | `overflow: auto`         | `ScrollView`              | `Column(Modifier.verticalScroll)` | `ScrollViewer`            |
| **`Spacer`**      | 弹性空间挤压器，把两边元素推开                   | `flex-grow: 1`           | `Spacer()`                | `Spacer`                          | *无等价，需调 Alignment*  |
| **`Divider`**     | 视觉分割线，极细的中性色线条                     | `<hr>` / `border-bottom` | `Divider()`               | `Divider`                         | `MenuFlyoutSeparator`     |

------

### 📝 2. 内容与排版层 (Content & Typography)

*架构核心：这一层必须严格绑定你的 `design-tokens.json` 里的 `typography` 字典。拒绝随意输入字号。*

| **统一 API 定义** | **功能与设计系统映射**                  | **🌐 Web (React)**               | **🍎 Apple (SwiftUI)**         | **🤖 Android (Compose)**             | **🪟 Windows (WinUI 3)**      |
| ----------------- | --------------------------------------- | ------------------------------- | ----------------------------- | ----------------------------------- | ---------------------------- |
| **`Text`**        | 基础正文渲染，支持多行截断              | `<span>` / `<p>`                | `Text`                        | `Text`                              | `TextBlock`                  |
| **`Heading`**     | 标题 (H1-H6)，绑定特定的字重和行高      | `<h1>` - `<h6>`                 | `Text().font(.title)`         | `Text(style=Typography.h1)`         | `TextBlock (Style=Title...)` |
| **`Image`**       | 位图渲染，支持圆角裁切和 ContentMode    | `<img>` / `object-fit`          | `Image().resizable()`         | `Image(contentScale)`               | `Image (Stretch)`            |
| **`Icon`**        | 纯色矢量图标，必须支持传入 `color` 变量 | `<svg>` / `fill="currentColor"` | `Image(systemName)`           | `Icon`                              | `FontIcon` / `PathIcon`      |
| **`Avatar`**      | 用户头像，通常强制为圆形，带默认占位符  | `<img>` + `border-radius: 50%`  | `Image().clipShape(Circle())` | `Image(Modifier.clip(CircleShape))` | `PersonPicture`              |

------

### 🕹️ 3. 操作与触发层 (Actions & Triggers)

*架构核心：处理用户的“点击”意图，所有的“彩色弥散光”和“交互态(Hover/Press)”都在这里实现。*

| **统一 API 定义** | **功能与设计系统映射**                   | **🌐 Web (React)**       | **🍎 Apple (SwiftUI)**            | **🤖 Android (Compose)**     | **🪟 Windows (WinUI 3)** |
| ----------------- | ---------------------------------------- | ----------------------- | -------------------------------- | --------------------------- | ----------------------- |
| **`Button`**      | 核心按钮，支持 Primary, Secondary, Ghost | `<button>`              | `Button`                         | `Button` / `OutlinedButton` | `Button`                |
| **`IconButton`**  | 只有图标没有文字的按钮，背景通常透明     | `<button>` + `<svg>`    | `Button(action: label: {Image})` | `IconButton`                | `AppBarButton`          |
| **`FAB`**         | 浮动操作按钮 (通常位于右下角，强引导)    | 绝对定位的 `<button>`   | 嵌套在 `ZStack` 的底部           | `FloatingActionButton`      | 绝对定位的 `Button`     |
| **`Menu`**        | 点击后弹出的下拉操作菜单                 | `<select>` / 自定义浮层 | `Menu` / `contextMenu`           | `DropdownMenu`              | `MenuFlyout`            |

------

### 🎛️ 4. 表单与录入层 (Data Entry)

*架构核心：数据双向绑定 (双端 State 同步) 的重灾区，必须统一对外暴露 `onChange` 或 `onValueChange`。*

| **统一 API 定义** | **功能与设计系统映射**              | **🌐 Web (React)**         | **🍎 Apple (SwiftUI)**        | **🤖 Android (Compose)**   | **🪟 Windows (WinUI 3)**        |
| ----------------- | ----------------------------------- | ------------------------- | ---------------------------- | ------------------------- | ------------------------------ |
| **`TextField`**   | 单行文本输入，支持前缀图标和报错态  | `<input type="text">`     | `TextField`                  | `OutlinedTextField`       | `TextBox`                      |
| **`TextArea`**    | 多行文本输入，支持自动撑开高度      | `<textarea>`              | `TextEditor`                 | `TextField` (多行模式)    | `TextBox (AcceptsReturn=True)` |
| **`Toggle`**      | 拨动开关 (如开启暗黑模式)           | `<input type="checkbox">` | `Toggle`                     | `Switch`                  | `ToggleSwitch`                 |
| **`Checkbox`**    | 勾选框 (支持选中、未选中、半选状态) | `<input type="checkbox">` | `Toggle(isOn:style:)`        | `Checkbox`                | `CheckBox`                     |
| **`RadioGroup`**  | 单选按钮组 (多选一)                 | `<input type="radio">`    | `Picker(style: .radioGroup)` | `RadioButton`             | `RadioButton`                  |
| **`Slider`**      | 滑动条 (参数调节，支持步进 Step)    | `<input type="range">`    | `Slider`                     | `Slider`                  | `Slider`                       |
| **`Segmented`**   | 分段控制器 (页面内的快速视图切换)   | 一组互斥的按钮            | `Picker(style: .segmented)`  | `ScrollableTabRow` (变体) | `RadioButtons` (横向)          |

------

### 🚨 5. 状态反馈层 (Feedback & Status)

*架构核心：系统与用户对话的媒介，这一层极度依赖各个平台的“原生动画”。*

| **统一 API 定义** | **功能与设计系统映射**                   | **🌐 Web (React)**        | **🍎 Apple (SwiftUI)**              | **🤖 Android (Compose)**     | **🪟 Windows (WinUI 3)**         |
| ----------------- | ---------------------------------------- | ------------------------ | ---------------------------------- | --------------------------- | ------------------------------- |
| **`Spinner`**     | 局部加载中 (无尽转圈)                    | CSS `@keyframes` 动画    | `ProgressView()`                   | `CircularProgressIndicator` | `ProgressRing`                  |
| **`ProgressBar`** | 线性进度条 (有具体进度的上传/下载)       | `<progress>` / `<meter>` | `ProgressView(value:)`             | `LinearProgressIndicator`   | `ProgressBar`                   |
| **`Badge`**       | 角标 (红点或未读数字，通常挂在 Icon 上)  | 绝对定位的圆点           | `.badge()` 修饰符                  | `Badge`                     | `InfoBadge`                     |
| **`Toast`**       | 底部轻提示 (几秒后自动消失，不打断操作)  | 自定义固定定位浮层       | 自定义 View 配合动画               | `Toast` / `Snackbar`        | `TeachingTip` / `InfoBar`       |
| **`Dialog`**      | 模态对话框 (强制打断，需用户点确定/取消) | `<dialog>`               | `.alert()` / `.confirmationDialog` | `AlertDialog`               | `ContentDialog`                 |
| **`Skeleton`**    | 骨架屏 (数据加载前的占位闪烁动画)        | 灰色块 + CSS 扫光动画    | `.redacted(reason: .placeholder)`  | 自定义 Modifier 画灰块      | `ProgressBar (IsIndeterminate)` |

------

### 🧭 6. 导航与结构层 (Navigation & Scaffolding)

*架构核心：App 的骨架，通常是最外层组件。*

| **统一 API 定义** | **功能与设计系统映射**                    | **🌐 Web (React)**          | **🍎 Apple (SwiftUI)**         | **🤖 Android (Compose)** | **🪟 Windows (WinUI 3)**   |
| ----------------- | ----------------------------------------- | -------------------------- | ----------------------------- | ----------------------- | ------------------------- |
| **`TopAppBar`**   | 顶部标题栏 (包含返回键、页面标题、操作键) | `header` / 粘性布局        | `NavigationView` / `.toolbar` | `TopAppBar`             | `TitleBar`                |
| **`BottomBar`**   | 底部全局导航 (我们刚才设计的深海青包裹区) | 固定在底部的容器           | `TabView`                     | `NavigationBar`         | `NavigationView (Bottom)` |
| **`Tabs`**        | 顶部/中部选项卡切换                       | 状态驱动的按钮组           | `TabView(selection:)`         | `TabRow` / `Tab`        | `TabView`                 |
| **`Drawer`**      | 侧边抽屉菜单 (向右滑出)                   | 绝对定位 + CSS `transform` | *需自定义或用三方库*          | `ModalNavigationDrawer` | `NavigationView (Left)`   |

------

### 📦 7. 复合模块展示 (Complex Data Display)

*架构核心：基于基础原子封装，重点在于处理大数据量的“长列表性能优化”。*

| **统一 API 定义** | **功能与设计系统映射**             | **🌐 Web (React)**            | **🍎 Apple (SwiftUI)**    | **🤖 Android (Compose)**       | **🪟 Windows (WinUI 3)** |
| ----------------- | ---------------------------------- | ---------------------------- | ------------------------ | ----------------------------- | ----------------------- |
| **`List`**        | 高性能长列表，只渲染可视区域内容   | 虚拟列表 (如 `react-window`) | `List` / `LazyVStack`    | `LazyColumn`                  | `ListView`              |
| **`Card`**        | 表面容器，带有阴影、圆角和高亮状态 | `Box` 加阴影                 | `GroupBox` 或 自定义视图 | `Card` / `ElevatedCard`       | 自定义 `Border` + 阴影  |
| **`Chip/Tag`**    | 数据标签，用于搜索过滤或状态标记   | 小号圆角背景 + 文字          | 文字加 `.background`     | `FilterChip` / `AssistChip`   | `InfoBadge`             |
| **`Accordion`**   | 折叠面板 (点击展开详细内容)        | `<details>` & `<summary>`    | `DisclosureGroup`        | 状态控制 `AnimatedVisibility` | `Expander`              |

------

### 💡 架构落地建议 (Implementation Strategy)

不要一上来就写复杂的 `DatePicker` 或 `ScrollView`。

**建议的实施路径是“由内向外”：**

1. **阶段一（打地基）：** 先用 Token 体系实现 `Box`, `Text`, `Icon`。只要这三个通了，颜色和排版引擎就稳了。
2. **阶段二（造积木）：** 组合第一步的原子，实现 `Button` 和 `TextField`，攻克用户点击、输入和焦点态（Focus）的跨平台一致性。
3. **阶段三（搭骨架）：** 实现 `VStack`, `HStack`, `List`。处理好各平台的间距（Padding/Margin）引擎。
4. **阶段四（拼界面）：** 最后才是拼装像 `BottomBar` 这样的高级复合组件。


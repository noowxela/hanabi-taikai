# 像素画“逻辑”入门：给准备开发像素游戏的你

> 写给 Alex。目标不是让你变成像素画师，而是让你在写第一行引擎代码之前，知道像素画为什么“讲规矩”、哪些规矩会直接影响工程设置。
> 资料核实时间：2026-10-06（UTC+8）。正文中带链接的结论都来自本次实际打开过的页面；标注“〔通行做法，未找到可引用来源〕”的内容是业内常识，请自行判断。

---

## 0. 一句话理解像素画

像素画的核心不是“分辨率低”，而是**每个像素都经过有意识的控制**。Slynyrd 认为像素画“头号定义因素是意图（intention）”，像素要“经过深思熟虑、精确地放置”（[Pixelblog 5 – Back to Basics](https://www.slynyrd.com/blog/2018/5/16/pixelblog-5-back-to-basics)，2018-05-22）。Lospec 的入门文章也说：重点是控制画布上的每个像素，“没有一个像素是电脑生成的”（[Pixel Art: Where to Start](https://lospec.com/articles/pixel-art-where-to-start/)，2019-06-14）。

对开发者来说，这意味着：**引擎绝不能替你“改”像素**，比如插值模糊、非整数缩放、旋转重采样。下面每一节其实都围绕这一点展开。

---

## 1. 分辨率与像素密度

### 1.1 选 8 / 16 / 32 / 64 的取舍

- **分辨率越低，越要取舍细节**。Saint11 的 Resizing 教程说：分辨率降低时，你得决定哪些细节重要；分辨率越高，通常需要越多颜色；更大的分辨率才容得下更写实的风格和更圆润的形状（[Saint11 – Resizing](https://saint11.art/img/pixel-tutorials/Resizing.gif)，见 [教程总页](https://saint11.art/blog/pixel-art-tutorials/)，2020-07-12）。
- **瓦片尺寸**：Slynyrd 认为 16×16 px “可能是最常见的尺寸”，并且建议用 2 的幂，因为它们的倍数最整齐；他还说瓦片“超过 32×32 px 对像素画来说似乎有点过头”（[Pixelblog 28 – Side View Tiles](https://www.slynyrd.com/blog/2020/5/21/pixelblog-28-side-view-tiles)，2020-05-26）。他也有专门用 8×8 tilemap 配 NES 调色板做的系列（[Pixelblog 目录 #59](https://www.slynyrd.com/pixelblog-catalogue)）。
- 实用换算（简单算术）：在 320×180 的画面里，16 px 高的角色大约是屏幕高度的 1/11；在 640×360 里约为 1/22。角色越小，场景越“开阔”，但五官、武器这些可读性细节也越少。
- 〔通行做法，未找到可引用来源〕大致经验：8 px 适合极简或 Game Boy/PICO-8 风格；16 px 是独立游戏的主流选择；32 px 能画表情和服装；64 px 的工作量会成倍增长（动画帧数 × 面积）。

### 1.2 统一像素尺度与 mixels

**整个画面里一个“美术像素”在屏幕上必须一样大。** 如果把一个 16 px 的道具放大 2 倍，摆到 1 倍的角色旁边，就出现了 **mixels**（mixed pixels）。Wiktionary 的定义是：像素画中“与整幅作品相比尺寸不一致的像素”（[mixel – Wiktionary](https://en.wiktionary.org/wiki/mixel)，最后编辑于 2026-01-24）。补救方法不是缩放，而是重画：Saint11 开篇就写“缩放和旋转像素画应该总是避免；想做好，就没有捷径，你得重画”（[Resizing](https://saint11.art/img/pixel-tutorials/Resizing.gif)）。

### 1.3 为什么旋转和非整数缩放会破坏网格

屏幕只能显示整像素。Godot 文档给了一个具体例子：640×360 的视口放进 1366×768 的窗口，比例约为 2.133×，结果每个美术像素对应 2.133×2.133 个屏幕像素，这只能变成“有的 2 格、有的 3 格”，于是线宽不一、棋盘格不均匀；改成整数缩放（2×，即 1280×720 加黑边）后才均匀（[Godot – Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)，Godot 4.7 文档，日期未标注）。旋转也一样：45° 旋转后的每个点都落在格子之间，重采样时会有像素被复制或丢掉，轮廓和单像素线就断了。Aseprite 内置 RotSprite 旋转算法来缓解这个问题（见 [Steam 页面功能列表](https://store.steampowered.com/app/431730/Aseprite/)），但 Saint11 的建议仍然是能重画就重画。

---

## 2. 线条

- **完美线（perfect lines）**：斜率为 0:1、1:2、1:1、2:1、1:0 的线最容易被眼睛顺着读，被称为“perfect lines”；交替使用 2 段和 1 段来模拟 1.5 的“中间线”就难看得多，应少用（[OpenGameArt – Chapter 2: Lines and Curves](https://opengameart.org/content/chapter-2-lines-and-curves)，日期未标注）。
- **等长线段**：直的斜线必须由**长度相同的小线段**组成，例如 2-2-2-2。只要有一段不同，眼睛马上会看出“凸起”，这就是 jaggy（[Lospec – Pixel Art Outlines Tutorial](https://lospec.com/articles/pixel-art-outlines/)，2016-04-03）。
- **jaggies 的定义与修法**：Pixel Joint 教程说，jaggies 是“一个或一组像素放错位置，打断了线条的流向”，常见的修法是**统一线段长度**，必要时加 AA（[Pixel Joint – The Pixel Art Tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299&PD=0)，帖子 2010-11 至 2014-07）。
- **曲线**：线段长度要**单调渐变**。Lospec 的反例是 5,2,1,2,1 会鼓起一个包，改成 5,2,2,1,1 才顺；圆的最长线段放在上下左右，越往 45° 方向越短（[Pixel Art Outlines Tutorial](https://lospec.com/articles/pixel-art-outlines/)）。
- **doubles（双像素/L 形拐角）**：单像素线的线段之间应该**只在对角相接**，否则会出现局部变粗的 L 形拐角，看起来“粗、毛”（同上 Lospec 文章）。Aseprite 的 “pixel perfect strokes” 就是自动清除这种多余像素的画笔选项（[Steam 功能列表](https://store.steampowered.com/app/431730/Aseprite/)）。
  - 注意：**doubles 不是“孤立像素（orphan pixels）”**。孤立像素是周围没有同色邻居、单独一个的噪点，属于另一类问题。〔术语区分为通行用法〕

---

## 3. 颜色

### 3.1 有限调色板与常用色板（均为 Lospec 实际页面，页面未标注日期）

| 调色板 | 颜色数 | 作者 | 页面 |
|---|---|---|---|
| PICO-8 | 16 | Lexaloffle Games（PICO-8 幻想主机） | [lospec.com/palette-list/pico-8](https://lospec.com/palette-list/pico-8) |
| DawnBringer 16 | 16 | DawnBringer | [lospec.com/palette-list/dawnbringer-16](https://lospec.com/palette-list/dawnbringer-16) |
| DawnBringer 32 | 32 | DawnBringer | [lospec.com/palette-list/dawnbringer-32](https://lospec.com/palette-list/dawnbringer-32) |
| Endesga 32 | 32 | ENDESGA（最初为 NYKRA 制作） | [lospec.com/palette-list/endesga-32](https://lospec.com/palette-list/endesga-32) |
| Resurrect 64 | 64 | Kerrie Lake | [lospec.com/palette-list/resurrect-64](https://lospec.com/palette-list/resurrect-64) |

每个页面都可以下载 `.hex`、`.gpl`、`.pal`、`.ase` 等格式，直接导入 Aseprite。**为什么要限制颜色**：颜色少，美术风格才统一，也逼着你靠明度把形体讲清楚。Slynyrd 在瓦片教程里提醒，“颜色太多，纹理会变糊”（[Pixelblog 20 – Top Down Tiles](https://www.slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles)，2019-08-27）。

### 3.2 色带（ramp）与色相偏移（hue shifting）

Slynyrd 的方法（[Pixelblog 1 – Color Palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes)，2018-01-16）：

- **色带**是一组按亮度排列、彼此协调的颜色。
- 亮度升高时要**降低饱和度**，否则会刺眼；很暗的颜色饱和度太高会显得“沉重”。一般来说，暗色饱和度更高，中间色往往是饱和度的峰值（他说这不是硬性规则）。
- **色相偏移**：沿色带改变色相。他的示例调色板是每条色带 9 个色块、相邻色块正向偏移 20°，并说“20° 大概是我用到的上限”。只改亮度和饱和度的“直色带（straight ramps）”缺乏趣味，也难以与其他色带协调。

### 3.3 明度对比

形体是否看得清，主要靠明度差，而不是色相差。Lospec 的轮廓文章强调，描边的目的就是**增加对比，绝不能降低对比**（[Outlines Part 2: Using Color](https://lospec.com/articles/pixel-art-outlines-part-2-using-color/)，2016-04-03）。〔通行做法，未找到可引用来源〕自查方法：把画面临时转成灰度，主角和背景仍能一眼区分才算合格。

---

## 4. 明暗与造型

- **先定光源**：Slynyrd 说，光源应该在任何插画的一开始就确定，它决定阴影的走向和高光的位置（[Pixelblog 6 – Light and Shadow](https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow)，2018-06-19）。
- **枕头式明暗（pillow shading）**：从中心向外一圈圈加深。它的问题“不在于光从正面来”，而在于明暗贴着平面轮廓走，没有表现三维形体如何受光（[Pixel Joint 教程](https://pixeljoint.com/forum/forum_posts.asp?TID=11299&PD=0)）。
- **banding**：相邻的色带在同一 x 或 y 坐标上对齐，网格就暴露了，画面的表观分辨率也会下降。常见形式有 hugging（描边紧贴色块）、fat pixels、skip-one banding、45° banding 等（同上）。
- **抖动（dithering）何时用**：最常见的错误是用太多。如果抖动覆盖了半个精灵，不如直接加一个颜色；抖动最好用来**收尖色块的边缘和末端**，作为两色之间的过渡，否则它会变成一块多余的纹理（同上）。〔通行做法〕抖动在动画和滚动背景上容易闪烁，大面积使用前要在引擎里实际跑一下。
- **手动抗锯齿（manual AA）**：只有水平、垂直和 45° 线不会产生锯齿，其他角度都会有阶梯。手动 AA 就是在阶梯拐角**手工放置中间色**来过渡（同上）。注意不要做“外部 AA”：游戏精灵的背景会变，外缘用背景色做 AA 换个背景就露馅。
- **描边（outlines）**：描边能把物体从背景和其他物体中分离出来，所以在游戏精灵里很常见（[Lospec – Outlines Tutorial](https://lospec.com/articles/pixel-art-outlines/)）。
- **selout（selective outlining，选择性描边）——正确定义**：
  - Lospec 的说法：**在不同位置使用不同颜色的描边**。物体最暗的地方描边用深色，最亮的地方用较浅的颜色，目的是让描边与物体之间的对比在一圈上保持一致；而且要考虑背景色（[Outlines Part 2](https://lospec.com/articles/pixel-art-outlines-part-2-using-color/)）。
  - Pixel Joint 教程更严格：sel-out（也叫 broken outlines）是“把描边向背景色做 AA”，并明确说它**不等于按光源给描边上明暗**，只适合背景可预知的场景，比如背景总是很暗的游戏（[Pixel Joint 教程](https://pixeljoint.com/forum/forum_posts.asp?TID=11299&PD=0)）。
  - 两种说法的共同点：**selout 就是描边颜色随位置变化，而不是全黑实线**。它与“孤立像素”毫无关系。

---

## 5. 动画

- **走路**：Saint11 的 Walk Cycle 给出两档：**12 帧**（每条腿 6 帧，流畅），**6 帧**（每条腿 3 帧，适合低分辨率）。6 个重要帧依次是 Contact、Down、Down+（最低点）、Prepare Passing、Passing、Up（最高点）；手臂总是与对侧腿同向（[Saint11 – Walk](https://saint11.art/img/pixel-tutorials/Walk.gif)）。
- **跑步**：Saint11 的 Simple Run 对比了 **8 帧和 16 帧**，一个简单循环可以理解为 4 帧，再用另一条腿重复（[Saint11 – RunCycleSimple](https://saint11.art/img/pixel-tutorials/RunCycleSimple.gif)）。
- **时长（有来源的数字）**：Slynyrd 的示例中，8 帧跑步循环每帧 **80 ms**，4 帧循环每帧 **160 ms**，两者总时长都是 640 ms，减帧时必须同时调节播放速度才能保住节奏和能量。他还说“中间帧太多会让动作显得拖沓”；Mega Man 的跑步只有 3 张图（循环 4 帧，passing 帧用了两次）（[Pixelblog 8 – Intro to Animation](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation)，2018-08-21）。
- **待机（idle）**：8-bit JRPG 常复用 2 帧走路做待机；最常见的是“呼吸式上下弹”。规模小的团队不一定每个角色都做 8 帧待机，关键是风格统一（同上）。
- **亚像素动画（sub-pixel）**：Saint11 说，你不能移动不到 1 像素的距离，但可以“伪造”：用颜色渐变制造 <1 px 的移动错觉，先移动物体内部再移动轮廓，主要移动光影而不是形状，让轮廓几乎不变；颜色太多会让画面变糊（[Saint11 – Subpixel](https://saint11.art/img/pixel-tutorials/Subpixel.gif)）。
- **smear 帧 / 运动模糊**：Saint11 的 Motion Blur 指出，运动模糊会把图像“抹开（smear）”，像要把它和上一帧连起来，这是表现复杂高速动作的廉价手段；亮色“渗”到暗色上，暗色用于淡出（[Saint11 – MotionBlur](https://saint11.art/img/pixel-tutorials/MotionBlur.gif)）。
- **挤压拉伸与预备动作**：最重要的规则是“**质量不变**”，变宽就要变矮。拉伸是平滑快速动画的廉价办法；**预备动作（anticipation）**是朝动作的**反方向**先挤压；硬物变形要少；还可以在游戏代码里给物体加挤压拉伸的 tween（[Saint11 – Squash](https://saint11.art/img/pixel-tutorials/Squash.gif)）。

---

## 6. 瓦片

- **尺寸**：16×16 最常见，用 2 的幂（见 §1.1 的 Slynyrd 来源）。
- **无缝**：让簇（cluster）跨过边缘、从另一侧绕回来，可以隐藏接缝；不要让瓦片内任何区域在视觉上过于突出，否则重复规律会很明显；颜色要少（[Pixelblog 20](https://www.slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles)）。在 Aseprite 里可以打开 `View > Tiled Mode`，边画边预览平铺效果（同上）。
- **自动拼接（autotiling）**：
  - **Tiled**：Terrain Set 分三种。Corner Set（按角匹配，2 种地形完整一套 16 块）；Edge Set（按边匹配，适合道路、栅栏、平台，2 种地形也是 16 块）；Mixed Set（角和边都匹配，2 种地形完整一套 256 块，但可以用 **47 块的 Blob tileset** 这类精简集）。一个 Terrain Set 最多 254 种地形（[Tiled – Using Terrains](https://doc.mapeditor.org/en/stable/manual/terrain/)，日期未标注）。
  - **16 块 / marching squares**：〔通行做法〕按四个角“是/否”的组合正好是 2⁴=16 种，这就是 Tiled Corner Set 的 16 块，也常被称为 marching squares 式拼接。
  - **Godot 4 terrain sets**：在 TileSet 中建立 Terrain Set，模式有 `Match Corners and Sides`、`Match Corners`、`Match Sides`，文档称这些模式对应 Godot 3.x 的 2×2、3×3、3×3 minimal 位掩码模式（文档未逐一配对），也与 Tiled 类似；然后给每个瓦片设置 Terrain Peering Bits，ID 从 0 开始，-1 表示空（[Godot – Using TileSets](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html)，Godot 4.7 文档，日期未标注）。〔通行做法〕“3×3 minimal”在社区里通常就是指 47 块 blob 集。

---

## 7. 引擎设置

### 7.1 基础分辨率与整数缩放（算术）

| 基础分辨率 | → 1280×720 | → 1920×1080 | → 2560×1440 | → 3840×2160 |
|---|---|---|---|---|
| 320×180 | ×4 ✅ | ×6 ✅ | ×8 ✅ | ×12 ✅ |
| 384×216 | 3.33 → ×3 = 1152×648 + 黑边 | **×5 ✅**（384×5=1920, 216×5=1080） | 6.67 → ×6 = 2304×1296 + 黑边 | ×10 ✅ |
| 480×270 | 2.67 → ×2 = 960×540 + 黑边 | **×4 ✅** | 5.33 → ×5 = 2400×1350 + 黑边 | ×8 ✅ |
| 640×360 | ×2 ✅ | **×3 ✅** | ×4 ✅ | ×6 ✅ |

这几个基础分辨率在 1080p 下都是整数倍。320×180 和 640×360 在四种常见 16:9 屏幕上都没有黑边。Godot 官方也说多数像素游戏视口在 256×224 到 640×480 之间，并推荐 640×360 作为基线，因为它在整数缩放下“无黑边地”放大到 720p/1080p/1440p/4K（[Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)）。

### 7.2 Godot 4 推荐设置（官方文档原文对照）

- `Display > Window > Size`：设为你的基础分辨率，如 640×360。
- `Display > Window > Stretch > Mode` = `viewport`（先以基础分辨率渲染，再整体放大；如果要允许亚像素移动或旋转，则用 `canvas_items`）。
- `Stretch > Aspect` = `keep`（加黑边）或 `expand`。
- `Stretch > Scale Mode` = `integer`（Godot 4.2 起提供，将缩放系数向下取整，“防止像素画失真”）。
- `Rendering > Textures > Canvas Textures > Default Texture Filter`：改为 `Nearest`（文档中该项默认值为 1；`TEXTURE_FILTER_NEAREST` 只读取最近的像素，所以画面保持“像素化”）。来源：[ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)、[CanvasItem](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html)。
- `Rendering > 2D > Snap > Snap 2D Transforms To Pixel`：默认 `false`。打开后，CanvasItem 内部会吸附到整像素，“适合低分辨率像素画游戏”，代价是移动不够平滑（Camera2D smoothing 时尤其明显）。`Snap 2D Vertices To Pixel` 作用类似，但**官方不建议两者同时开**，“只开 transforms 那一项”即可。两项都只在启动时读取（[ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html)）。
- 全屏请用 **Exclusive Fullscreen**：普通 Fullscreen 会少 1 像素高度，可能让整数缩放降一档（[Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html)）。

### 7.3 Unity（URP）2D Pixel Perfect Camera

来源：[Pixel Perfect Camera 组件参考](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/2d-pixelperfect-ref.html)、[简介](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/2d-pixelperfect-intro.html)、[准备精灵](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/2d-pixelperfect-prep-sprites.html)（Unity 6.2 手册，页面构建于 2026-02-05）。

- 把组件挂在主 Camera 上。
- **精灵导入**：所有精灵用**同一个 Pixels Per Unit**；`Filter Mode` = `Point`；`Compression` = `None`；Pivot Unit Mode 设为 Pixels。
- **Assets Pixels Per Unit**：与精灵的 PPU 一致。
- **Reference Resolution**：美术设计时用的分辨率，比如 320×180。
- **Crop Frame**：宽高比不同时如何加黑边。
- **Grid Snapping**：`Upscale Render Texture`（先渲染到接近参考分辨率的临时纹理再放大，得到无 AA、不旋转的像素）或 `Pixel Snapping`（渲染时把 Sprite Renderer 吸附到世界网格，防止亚像素移动，但不改 Transform）。
- **Filter Mode**（仅 Stretch Fill 时可用）：`Retro AA`（先整数倍放大，再用双线性补足剩余部分）或 `Point`。文档提醒，这样放大可能放错像素位置，失去 pixel perfect。

### 7.4 通用原则

最近邻采样（Nearest/Point），不压缩，统一 PPU，整数缩放，摄像机和精灵位置按像素吸附。如果角色需要平滑移动，就把“逻辑坐标”保留为浮点数，只在渲染时取整。〔后半句为通行做法〕

---

## 8. 工具（价格与许可以官方页面为准）

| 工具 | 官方地址 | 许可 / 价格（2026-10-06 实际看到的） |
|---|---|---|
| **Aseprite** | [aseprite.org](https://www.aseprite.org/) · [GitHub](https://github.com/aseprite/aseprite) | **source-available，不是开源**。源码和官方二进制都按 Aseprite **EULA** 发布（部分模块是 MIT）；可以自己下载源码编译、个人使用，也可以做商用美术，但**不能再分发**。2016 年 8 月起，GPLv2 换成了 EULA（[FAQ](https://www.aseprite.org/faq/)、[EULA](https://raw.githubusercontent.com/aseprite/aseprite/main/EULA.txt)）。Steam 美区标价 **$19.99**，核实当天 40% 折扣为 $11.99（[Steam](https://store.steampowered.com/app/431730/Aseprite/)，Steam 价格接口返回值）；官网 [购买页](https://www.aseprite.org/buy/) 由支付组件动态显示价格，静态页面上看不到数字。 |
| **Pixelorama** | [itch.io](https://orama-interactive.itch.io/pixelorama) · [GitHub](https://github.com/Orama-Interactive/Pixelorama) | **MIT 开源**，itch 上“Name your own price”（可免费下载），当时版本 v1.2.3；仓库本身是一个 Godot 项目（含 `project.godot`）。 |
| **LibreSprite** | [libresprite.github.io](https://libresprite.github.io/) · [GitHub](https://github.com/LibreSprite/LibreSprite) | **GPLv2**，是“Aseprite 最后一个 GPLv2 提交的分支”。 |
| **Piskel** | [piskelapp.com](https://www.piskelapp.com/) · [GitHub](https://github.com/piskelapp/piskel) | 免费在线编辑器，代码开源（GitHub 标注 **Apache-2.0**），另有 Windows/macOS/Linux 离线版。 |
| **Pyxel Edit** | [pyxeledit.com](https://pyxeledit.com/) · [获取页](https://pyxeledit.com/get.php) · [About](https://pyxeledit.com/about.php) | **商业软件，不开源**（作者 Daniel Kvarfordt，基于 Adobe AIR）。付费 beta 通过 Humble Widget 购买，页面上没有直接显示价格；免费的旧版 0.2.22c 已不再维护，缺少动画等功能。它的强项是瓦片编辑。 |

选择建议：预算允许就买 Aseprite（动画时间轴、Pixel Perfect 笔刷、Tiled Mode、命令行导出精灵表都很适合开发流程）；想要零成本又开源，就选 Pixelorama 或 LibreSprite。

---

## 9. 学习资源（均已打开确认）

- **Saint11（Pedro Medeiros）**：[Pixel Art Tutorials](https://saint11.art/blog/pixel-art-tutorials/)（每张 512×512 的 GIF 教程，免费）；面向零基础的 [Pixel Art Articles](https://saint11.art/pixel_articles)（2025-01-26，讲 Aseprite 基础、明暗、AA 与 banding、线条等）。
- **Slynyrd Pixelblog（Raymond Schlitter）**：[完整目录](https://www.slynyrd.com/pixelblog-catalogue)，目前到第 64 篇。建议先读 #1 调色板、#5 基础、#6 光影、#8 动画入门、#20/#28 瓦片。
- **Lospec**：[Pixel Art Tutorials](https://lospec.com/pixel-art-tutorials)（页面显示收录 586 篇）、[Where to Start](https://lospec.com/articles/pixel-art-where-to-start/)、[Palette List](https://lospec.com/palette-list)。
- **Pixel Joint**：[The Pixel Art Tutorial（论坛长帖）](https://pixeljoint.com/forum/forum_posts.asp?TID=11299&PD=0)，术语定义很严谨。
- **YouTube**：[MortMort](https://www.youtube.com/@MortMort)、[AdamCYounis](https://www.youtube.com/@AdamCYounis)、[Brandon James Greer](https://www.youtube.com/@BJGpixel)（handle 是 `@BJGpixel`）。
- **Pixel Logic – A Guide to Pixel Art（Michael Azzi）**：[Gumroad](https://michafrar.gumroad.com/l/pixel-logic)，242 页 PDF，$10+，章节包括线稿、AA、颜色、可读性、抖动、视角、清理、亚像素、动画；2022 年更新对已购用户免费。Lospec 教程库把它列为 Featured，并标注 Michael Azzi（2018）。

---

## 新手开发者建议（Checklist）

- [ ] **先定基础分辨率**（推荐 640×360 或 320×180），列出目标屏幕，确认每种都是整数倍（§7.1 表）。
- [ ] **先定“一个美术像素 = 几个屏幕像素”**，整个项目不再改；严禁在引擎里缩放单个精灵（防 mixels）。
- [ ] Godot：`viewport` + `integer` + `Nearest` + 只开 `Snap 2D Transforms To Pixel`；Unity：Pixel Perfect Camera + `Point` + `Compression None` + 统一 PPU。
- [ ] **选一个现成调色板**（如 Endesga 32 或 Resurrect 64），项目前期不要自己调色。
- [ ] **定角色和瓦片尺寸**：如角色 16×24 或 32×32、瓦片 16×16，先做 1 个角色和 1 套地面瓦片，进引擎测试可读性。
- [ ] 画线时开 Aseprite 的 Pixel Perfect；检查每条斜线的线段长度是否相等，曲线是否单调渐变。
- [ ] **先定光源**（例如左上），所有精灵统一；避免 pillow shading 和 banding。
- [ ] 描边：先用深色实线，熟练后再尝试按区域变色的 selout；不要对外缘做 AA。
- [ ] 抖动只用于过渡，并在移动和滚动中实测是否闪烁。
- [ ] 动画先做关键帧：走路 6 帧（低分辨率）或 12 帧，跑步 4 到 8 帧，每帧约 80 到 160 ms 起调，用总时长控制“能量”。
- [ ] 地形用 Godot terrain set 或 Tiled Mixed Set；先做 16 块的 corner 集验证，再扩展到 47 块 blob。
- [ ] 不要旋转像素精灵。必须旋转的，就画 8 方向，或用 RotSprite 后再手修。
- [ ] 每周临摹 1 张 Saint11 或 Slynyrd 的教程图，比读理论更有效。

---

## 来源列表

| # | 来源 | 日期 |
|---|---|---|
| 1 | [Lospec – PICO-8 Palette](https://lospec.com/palette-list/pico-8) | 日期未标注 |
| 2 | [Lospec – Endesga 32](https://lospec.com/palette-list/endesga-32) | 日期未标注 |
| 3 | [Lospec – DawnBringer 16](https://lospec.com/palette-list/dawnbringer-16) | 日期未标注 |
| 4 | [Lospec – DawnBringer 32](https://lospec.com/palette-list/dawnbringer-32) | 日期未标注 |
| 5 | [Lospec – Resurrect 64](https://lospec.com/palette-list/resurrect-64) | 日期未标注 |
| 6 | [Lospec – Pixel Art Outlines Tutorial](https://lospec.com/articles/pixel-art-outlines/) | 2016-04-03 |
| 7 | [Lospec – Pixel Art Outlines Part 2: Using Color](https://lospec.com/articles/pixel-art-outlines-part-2-using-color/) | 2016-04-03 |
| 8 | [Lospec – Pixel Art: Where to Start](https://lospec.com/articles/pixel-art-where-to-start/) | 2019-06-14 |
| 9 | [Lospec – Pixel Art Tutorials](https://lospec.com/pixel-art-tutorials) | 日期未标注 |
| 10 | [Pixel Joint – The Pixel Art Tutorial](https://pixeljoint.com/forum/forum_posts.asp?TID=11299&PD=0) | 帖子 2010-11 至 2014-07 |
| 11 | [OpenGameArt – Chapter 2: Lines and Curves](https://opengameart.org/content/chapter-2-lines-and-curves) | 日期未标注 |
| 12 | [Wiktionary – mixel](https://en.wiktionary.org/wiki/mixel) | 最后编辑 2026-01-24 |
| 13 | [Saint11 – Pixel Art Tutorials](https://saint11.art/blog/pixel-art-tutorials/)（含 [Walk](https://saint11.art/img/pixel-tutorials/Walk.gif)、[RunCycleSimple](https://saint11.art/img/pixel-tutorials/RunCycleSimple.gif)、[Subpixel](https://saint11.art/img/pixel-tutorials/Subpixel.gif)、[MotionBlur](https://saint11.art/img/pixel-tutorials/MotionBlur.gif)、[Squash](https://saint11.art/img/pixel-tutorials/Squash.gif)、[Resizing](https://saint11.art/img/pixel-tutorials/Resizing.gif)） | 2020-07-12 |
| 14 | [Saint11 – Pixel Art Articles](https://saint11.art/pixel_articles) | 2025-01-26 |
| 15 | [Slynyrd – Pixelblog 1 Color Palettes](https://www.slynyrd.com/blog/2018/1/10/pixelblog-1-color-palettes) | 2018-01-16 |
| 16 | [Slynyrd – Pixelblog 5 Back to Basics](https://www.slynyrd.com/blog/2018/5/16/pixelblog-5-back-to-basics) | 2018-05-22 |
| 17 | [Slynyrd – Pixelblog 6 Light and Shadow](https://www.slynyrd.com/blog/2018/6/15/pixelblog-6-light-and-shadow) | 2018-06-19 |
| 18 | [Slynyrd – Pixelblog 8 Intro to Animation](https://www.slynyrd.com/blog/2018/8/19/pixelblog-8-intro-to-animation) | 2018-08-21 |
| 19 | [Slynyrd – Pixelblog 20 Top Down Tiles](https://www.slynyrd.com/blog/2019/8/27/pixelblog-20-top-down-tiles) | 2019-08-27 |
| 20 | [Slynyrd – Pixelblog 28 Side View Tiles](https://www.slynyrd.com/blog/2020/5/21/pixelblog-28-side-view-tiles) | 2020-05-26 |
| 21 | [Slynyrd – Pixelblog Catalogue](https://www.slynyrd.com/pixelblog-catalogue) | 日期未标注 |
| 22 | [Godot – Multiple resolutions](https://docs.godotengine.org/en/stable/tutorials/rendering/multiple_resolutions.html) | Godot 4.7 文档，日期未标注 |
| 23 | [Godot – ProjectSettings](https://docs.godotengine.org/en/stable/classes/class_projectsettings.html) | 日期未标注 |
| 24 | [Godot – CanvasItem](https://docs.godotengine.org/en/stable/classes/class_canvasitem.html) | 日期未标注 |
| 25 | [Godot – Using TileSets](https://docs.godotengine.org/en/stable/tutorials/2d/using_tilesets.html) | 日期未标注 |
| 26 | [Tiled – Using Terrains](https://doc.mapeditor.org/en/stable/manual/terrain/) | 日期未标注 |
| 27 | [Unity – Pixel Perfect Camera component reference (URP)](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/2d-pixelperfect-ref.html) | 构建于 2026-02-05 |
| 28 | [Unity – Introduction to the Pixel Perfect Camera (URP)](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/2d-pixelperfect-intro.html) | 构建于 2026-02-05 |
| 29 | [Unity – Prepare your sprites (URP)](https://docs.unity3d.com/6000.2/Documentation/Manual/urp/2d-pixelperfect-prep-sprites.html) | 构建于 2026-02-05 |
| 30 | [Aseprite 官网](https://www.aseprite.org/) / [FAQ](https://www.aseprite.org/faq/) / [Buy](https://www.aseprite.org/buy/) | 日期未标注 |
| 31 | [Aseprite GitHub](https://github.com/aseprite/aseprite) / [EULA.txt](https://raw.githubusercontent.com/aseprite/aseprite/main/EULA.txt) | 日期未标注 |
| 32 | [Aseprite on Steam](https://store.steampowered.com/app/431730/Aseprite/) | 发行 2016-02-22；价格于 2026-10-06 查询 |
| 33 | [Pixelorama – itch.io](https://orama-interactive.itch.io/pixelorama) / [GitHub](https://github.com/Orama-Interactive/Pixelorama) | 日期未标注（版本 v1.2.3） |
| 34 | [LibreSprite](https://libresprite.github.io/) / [GitHub](https://github.com/LibreSprite/LibreSprite) | 日期未标注 |
| 35 | [Piskel](https://www.piskelapp.com/) / [GitHub](https://github.com/piskelapp/piskel) | 日期未标注 |
| 36 | [Pyxel Edit](https://pyxeledit.com/) / [Get](https://pyxeledit.com/get.php) / [About](https://pyxeledit.com/about.php) | 日期未标注 |
| 37 | [Pixel Logic – Gumroad](https://michafrar.gumroad.com/l/pixel-logic) | 日期未标注（页面提及 2022 更新） |
| 38 | [MortMort](https://www.youtube.com/@MortMort)、[AdamCYounis](https://www.youtube.com/@AdamCYounis)、[Brandon James Greer](https://www.youtube.com/@BJGpixel) | 频道页，日期未标注 |

# Tudooo IP 形象提示词规范

版本：1.0
建立日期：2026-10-16
状态：角色母版已由用户确认，后续涉及 Tudooo 的图片生成均须遵守。

## 角色母版

用户提供的「土豆小人素材选择图」是 Tudooo 的最高优先级视觉参考。每次生成角色图时都要附上该参考图作为图像输入；提示词不能代替参考图。母版核心如下：

- **轮廓**：一颗矮胖、柔软、近似小梨形/团子形的浅土豆色身体；头身连成一体，轮廓圆润，底部略平稳。
- **芽叶**：头顶固定一小簇嫩绿色双叶芽，是识别角色的重要标志。叶片可以轻微改变朝向，不改变数量和位置感。
- **脸部**：小而深棕的圆点眼、非常简洁的小嘴、淡淡的暖粉腮红；眼睛大小、间距和面部位置保持稳定。表情温和、好奇、朴拙。
- **四肢**：短小、贴近身体，造型简洁；不能让服装或道具遮掉芽叶与主要脸部特征。
- **画风**：温暖绘本感的手绘彩铅；纸张颗粒、轻微蜡笔/水彩叠色、自然且略有手绘起伏的深棕线稿。
- **色彩**：奶油米、土豆浅褐、叶片鼠尾草绿、海岸雾蓝、少量暖橘；整体低饱和、柔和，不荧光、不高对比。
- **气质**：亲切、安静、带一点笨拙的可爱；避免塑料感、精致潮玩感和强烈商业 3D 渲染。

## 可以变化的内容

可按功能替换衣物、帽子、背包、工具、季节装饰、手持物和场景。新增装饰应服务于角色身份或页面功能，尺度克制。多个 Tudooo 同框时，所有角色都要遵循同一身体比例、芽叶、脸部比例和线稿语言；只通过颜色、服饰、动作与小道具区分个体。

透明贴纸素材应采用透明背景，完整保留角色与必要道具，四周留出安全边距。卡面/PFP 应让 Tudooo 成为主体，画面仍需适配正方形裁切。若素材必须包含中文文字，优先让生成图不带文字，并由界面代码排版，除非用户明确确认要把文字烘焙进图。

## 可复用提示词模板

每次生成时，先附上用户确认的 Tudooo 参考图，再将方括号内容替换为本次需求：

```text
Use the attached Tudooo reference image as the strict character identity source. Create [用途、动作、服饰、道具和场景]. Preserve the same compact pear-shaped pale potato body, the small two-leaf green sprout at the top, tiny dark-brown dot eyes, simple tiny mouth, subtle warm blush, short close-to-body limbs, and the same gentle face proportions. Keep Tudooo immediately recognizable as the same character; change only pose, outfit, props, and setting.

Warm hand-drawn colored-pencil storybook illustration on softly textured paper, lightly layered watercolor/pencil grain, slightly imperfect dark-brown outline, muted cream, potato beige, sage green and coastal mist-blue palette, soft natural light, charming and understated. [输出构图/透明底/裁切要求].

Do not redesign the mascot. No different species or body silhouette, no extra sprouts, no changed eye style or face proportions, no human anatomy, no long limbs, no sharp teeth, no glossy 3D, no plastic toy look, no neon colors, no high saturation, no photorealism, no heavy black shadows, no visual clutter, no text, no watermark.
```

## 生成前后检查

1. 有无使用 Tudooo 母版图作为参考输入。
2. 身体仍是浅土豆色的矮胖团子/小梨形，头顶仍是双叶芽。
3. 点状眼、小嘴、腮红、面部比例及深棕线稿是否延续母版。
4. 彩铅纸纹和低饱和配色是否一致；是否避免 3D、荧光和过度光滑。
5. 角色特征是否被帽子、文字或道具遮住；正方形用途是否能安全裁切。
6. 新角色图先提供候选预览，用户确认后才替换运行时素材；不得把未经确认的候选直接上生产或推送 GitHub。

## 母版与归档

- 规范文件：`docs/design-system/TUDOOO_IP_PROMPT_GUIDE.md`
- 用户提供的母版图及每次生成的原图、候选稿，应归档到 `E:\土豆岛资源库`，按日期和用途分目录保存。
- 可在代码仓库中保留轻量规范和已确认的运行时素材；大尺寸生成原图及未选候选保存在资源库归档。

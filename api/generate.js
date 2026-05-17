export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: '只支持POST请求' });
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: '未配置API密钥，请联系管理员' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { prompt, selections = '', typeInfo = '' } = body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: '缺少分析数据' });
  }

  try {
    // Call Zhipu AI API
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [
          {
            role: 'system',
            content: `你是皮纹天赋解读专家，10年实战经验，解读过3000+案例。
你的风格：温暖、专业、鼓励性，用丰富的emoji让报告生动。
你熟悉皮纹学的8种核心纹型：螺旋斗(Ws)、靶心斗(Wt)、伸长斗(We)、双斗(Wc)、双箕斗(Wd)、正箕纹(Lu)、反箕纹(Rl)、弧形纹(X)。
你熟悉8种性格类型：超级认知型、认知型、超级模仿型、模仿型、逆思型R、整合型WC、完美型WPE、开放型X，以及复合性格类型。
输出要求：报告要有条理、有温度、有实用建议，避免绝对化表述，用emoji增加可读性。`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1200
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Zhipu API error:', response.status, errText);
      return res.status(500).json({
        success: false,
        error: `AI服务暂时不可用（${response.status}），请稍后重试`
      });
    }

    const data = await response.json();
    const report = data.choices?.[0]?.message?.content?.trim();

    if (!report) {
      return res.status(500).json({ success: false, error: 'AI未返回有效报告，请重试' });
    }

    // Format report into sections
    let formattedReport = `<div class="report-section"><h3>🔑 核心天赋</h3>`;
    
    // Extract first paragraph as core talents
    const paragraphs = report.split('\n\n');
    if (paragraphs.length > 0) {
      formattedReport += `<div class="advantage-tags">`;
      const coreTalents = paragraphs[0].split(/[，,、]/).filter(p => p.trim()).slice(0, 4);
      coreTalents.forEach(t => {
        formattedReport += `<span class="tag tag-primary">${t.trim()}</span>`;
      });
      formattedReport += `</div></div>`;
    }

    // Add remaining content
    paragraphs.slice(1).forEach((p, i) => {
      if (p.trim()) {
        const titles = ['性格优势', '学习风格', '发展方向', '家长建议', '核心特质', '天赋分析', '成长建议', '适合职业', '教育建议'];
        let sectionTitle = '💡 详细解读';
        titles.forEach(t => { if (p.includes(t)) sectionTitle = `📌 ${t}`; });
        
        // Add section class based on content
        let sectionClass = 'report-section';
        if (i === 0 || p.includes('优势') || p.includes('性格')) sectionClass = 'report-section';
        
        formattedReport += `<div class="${sectionClass}"><h3>${sectionTitle}</h3><p>${p.replace(/\n/g, '<br>')}</p></div>`;
      }
    });

    res.status(200).json({ success: true, report: formattedReport });

  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ success: false, error: '服务异常，请稍后重试' });
  }
}
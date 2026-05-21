import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
let ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/ZHIPU_API_KEY\s*=\s*(.+)/);
    if (match) {
      ZHIPU_API_KEY = match[1].trim().replace(/['"]/g, '');
    }
  }
} catch (e) {
  console.log('No .env file found');
}

const PORT = 8080;

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API endpoint
  if (req.method === 'POST' && req.url === '/api/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { prompt, selections, typeInfo } = JSON.parse(body);
        
        if (!ZHIPU_API_KEY) {
          res.writeHead(500);
          res.end(JSON.stringify({ 
            success: false, 
            error: '未配置智谱 API Key，请在 .env 文件中设置 ZHIPU_API_KEY' 
          }));
          return;
        }

        console.log('🤖 Calling Zhipu AI API...');
        
        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${ZHIPU_API_KEY}`,
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
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1200
          })
        });

        if (!response.ok) {
          const errText = await response.text();
          console.error('Zhipu API error:', response.status, errText);
          res.writeHead(500);
          res.end(JSON.stringify({ 
            success: false, 
            error: `AI服务暂时不可用（${response.status}）` 
          }));
          return;
        }

        const data = await response.json();
        const report = data.choices?.[0]?.message?.content?.trim();

        if (!report) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: 'AI未返回有效报告' }));
          return;
        }

        // Format report into sections
        let formattedReport = formatReport(report);
        
        console.log('✅ AI report generated successfully');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, report: formattedReport }));

      } catch (error) {
        console.error('API error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error.message }));
      }
    });
    return;
  }

  // Static file serving
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, filePath);
  
  const ext = path.extname(filePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
      res.end(content);
    }
  });
});

function formatReport(report) {
  const paragraphs = report.split('\n\n').filter(p => p.trim());
  let html = '';

  // First paragraph - core talents as tags
  if (paragraphs.length > 0) {
    html += `<div class="report-section"><h3>🔑 核心天赋</h3><div class="advantage-tags">`;
    // Extract keywords from first paragraph
    const keywords = paragraphs[0].match(/[🔑⭐🎯💡📚✨🌟]+[^🔑⭐🎯💡📚✨🌟\n]{2,20}/g) || [];
    const talents = keywords.slice(0, 4);
    if (talents.length === 0) {
      // Fallback: split by common delimiters
      const words = paragraphs[0].split(/[，,、\n]/).filter(w => w.trim().length > 2 && w.trim().length < 15);
      words.slice(0, 4).forEach(t => {
        html += `<span class="tag tag-primary">${t.trim()}</span>`;
      });
    } else {
      talents.forEach(t => {
        html += `<span class="tag tag-primary">${t.trim()}</span>`;
      });
    }
    html += `</div></div>`;
  }

  // Remaining paragraphs
  paragraphs.slice(1).forEach(p => {
    if (p.trim()) {
      // Extract title from first line if it looks like a title
      let title = '💡 详细解读';
      const lines = p.split('\n');
      if (lines[0].includes('优势') || lines[0].includes('性格')) title = '⭐ 性格优势';
      else if (lines[0].includes('学习')) title = '📚 学习风格';
      else if (lines[0].includes('发展') || lines[0].includes('职业')) title = '🎯 发展方向';
      else if (lines[0].includes('建议') || lines[0].includes('家长')) title = '💡 给家长/自己的建议';
      
      html += `<div class="report-section"><h3>${title}</h3><p>${p.replace(/\n/g, '<br>')}</p></div>`;
    }
  });

  return html;
}

server.listen(PORT, () => {
  console.log(`\n🚀 服务器已启动: http://localhost:${PORT}`);
  console.log(`📡 API 端点: http://localhost:${PORT}/api/generate`);
  console.log(`🔑 智谱 API Key: ${ZHIPU_API_KEY ? '已配置 ✅' : '未配置 ❌'}`);
  if (!ZHIPU_API_KEY) {
    console.log('\n⚠️  请创建 .env 文件并添加: ZHIPU_API_KEY=your_api_key');
  }
});

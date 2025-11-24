// Enhanced script to convert markdown to HTML that preserves ASCII art diagrams
const fs = require('fs');
const path = require('path');

// Read the markdown file
const markdownFile = path.join(process.cwd(), 'PROJECT_DOCUMENTATION.md');
const htmlFile = path.join(process.cwd(), 'PROJECT_DOCUMENTATION.html');

if (!fs.existsSync(markdownFile)) {
  console.error('PROJECT_DOCUMENTATION.md not found!');
  process.exit(1);
}

const markdown = fs.readFileSync(markdownFile, 'utf8');

// Enhanced markdown to HTML converter
function markdownToHTML(md) {
  let html = md;
  
  // Split into lines for better processing
  const lines = html.split('\n');
  let inCodeBlock = false;
  let codeBlockContent = [];
  let codeBlockLang = '';
  let result = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Detect code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        // End of code block
        const codeContent = codeBlockContent.join('\n');
        result.push(`<pre class="code-block"><code>${escapeHtml(codeContent)}</code></pre>`);
        codeBlockContent = [];
        codeBlockLang = '';
        inCodeBlock = false;
      } else {
        // Start of code block
        inCodeBlock = true;
        codeBlockLang = line.replace('```', '').trim();
      }
      continue;
    }
    
    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }
    
    // Process regular markdown lines
    let processedLine = line;
    
    // Headers - process in order from most specific to least
    if (line.match(/^#### /)) {
      processedLine = line.replace(/^#### (.*)$/, '<h4>$1</h4>');
    } else if (line.match(/^### /)) {
      processedLine = line.replace(/^### (.*)$/, '<h3>$1</h3>');
    } else if (line.match(/^## /)) {
      // Check if it's part of the title (like "## Final Project Documentation")
      // If it's on line 2 or 3, treat it as a subtitle
      if (i < 3 && lines[0].match(/^# /)) {
        processedLine = line.replace(/^## (.*)$/, '<h2 class="subtitle">$1</h2>');
      } else {
        processedLine = line.replace(/^## (.*)$/, '<h2>$1</h2>');
      }
    } else if (line.match(/^# /)) {
      processedLine = line.replace(/^# (.*)$/, '<h1>$1</h1>');
    } else {
      // Bold
      processedLine = processedLine.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      
      // Inline code
      processedLine = processedLine.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
      
      // Links
      processedLine = processedLine.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
      
      // Lists
      if (line.trim().startsWith('- ')) {
        processedLine = line.replace(/^-\s+(.*)$/, '<li>$1</li>');
      } else if (line.trim().startsWith('* ')) {
        processedLine = line.replace(/^\*\s+(.*)$/, '<li>$1</li>');
      } else if (line.match(/^\d+\.\s/)) {
        processedLine = line.replace(/^\d+\.\s+(.*)$/, '<li>$1</li>');
      }
      
      // Horizontal rule
      if (line.trim() === '---') {
        processedLine = '<hr>';
      }
      
      // Empty lines become paragraph breaks
      if (line.trim() === '') {
        processedLine = '</p><p>';
      }
    }
    
    result.push(processedLine);
  }
  
  // Handle any remaining code block
  if (inCodeBlock && codeBlockContent.length > 0) {
    const codeContent = codeBlockContent.join('\n');
    result.push(`<pre class="code-block"><code>${escapeHtml(codeContent)}</code></pre>`);
  }
  
  // Wrap in paragraphs and clean up
  html = result.join('\n');
  html = '<p>' + html + '</p>';
  
  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');
  html = html.replace(/<p>(<h[1-6]>)/g, '$1');
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
  html = html.replace(/<p>(<pre)/g, '$1');
  html = html.replace(/(<\/pre>)<\/p>/g, '$1');
  html = html.replace(/<p>(<hr>)/g, '$1');
  html = html.replace(/(<\/hr>)<\/p>/g, '<hr>');
  
  // Wrap consecutive list items in ul/ol
  html = html.replace(/(<li>.*<\/li>\n?)+/g, function(match) {
    return '<ul>' + match + '</ul>';
  });
  
  return html;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DJ Clownfish - Final Project Documentation</title>
    <style>
        @media print {
            @page {
                margin: 2cm;
            }
            body {
                font-size: 11pt;
            }
            .code-block {
                page-break-inside: avoid;
            }
        }
        
        * {
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
            background: #fff;
        }
        
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
            margin-top: 30px;
            page-break-after: avoid;
            font-size: 2.5em;
            font-weight: 700;
        }
        
        h2 {
            color: #34495e;
            margin-top: 30px;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 5px;
            page-break-after: avoid;
            font-weight: 700;
            font-size: 1.8em;
        }
        
        h2.subtitle {
            color: #555;
            margin-top: 10px;
            margin-bottom: 20px;
            border-bottom: none;
            font-size: 1.4em;
            font-weight: 600;
            font-style: italic;
        }
        
        /* Style for subtitle as bold text after h1 */
        h1 + p strong,
        h1 + strong {
            display: block;
            font-size: 1.4em;
            font-weight: 600;
            color: #555;
            margin-top: -10px;
            margin-bottom: 30px;
            font-style: italic;
        }
        
        h3 {
            color: #555;
            margin-top: 20px;
            page-break-after: avoid;
        }
        
        h4 {
            color: #666;
            margin-top: 15px;
            page-break-after: avoid;
        }
        
        p {
            margin: 10px 0;
            text-align: justify;
        }
        
        code.inline-code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
            color: #c7254e;
        }
        
        pre.code-block {
            background-color: #f8f8f8;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
            border-left: 4px solid #3498db;
            margin: 20px 0;
            font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
            font-size: 0.9em;
            line-height: 1.4;
            white-space: pre;
            word-wrap: normal;
            overflow-wrap: normal;
        }
        
        pre.code-block code {
            font-family: 'Courier New', 'Consolas', 'Monaco', monospace;
            font-size: inherit;
            background: transparent;
            padding: 0;
            border: none;
            color: #333;
            white-space: pre;
            display: block;
        }
        
        ul, ol {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        li {
            margin: 5px 0;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        
        th {
            background-color: #3498db;
            color: white;
        }
        
        hr {
            border: none;
            border-top: 2px solid #ecf0f1;
            margin: 30px 0;
        }
        
        a {
            color: #3498db;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        strong {
            font-weight: 600;
            color: #2c3e50;
        }
    </style>
</head>
<body>
${markdownToHTML(markdown)}
</body>
</html>`;

fs.writeFileSync(htmlFile, htmlContent, 'utf8');
console.log('✅ HTML file created: PROJECT_DOCUMENTATION.html');
console.log('📄 You can now:');
console.log('   1. Open PROJECT_DOCUMENTATION.html in your browser');
console.log('   2. Press Ctrl+P (or Cmd+P on Mac)');
console.log('   3. Select "Save as PDF"');
console.log('   4. Save as team#finalProjectTitle.pdf');
console.log('');
console.log('✨ Enhanced features:');
console.log('   - ASCII art diagrams preserved with monospace font');
console.log('   - Better code block formatting');
console.log('   - Improved print layout');

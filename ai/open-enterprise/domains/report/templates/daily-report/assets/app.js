const STATUS_COLOR_MAP = {
  orange: '#f57c00',
  green: '#4caf50',
  red: '#f44336'
};

const STATUS_BG_MAP = {
  orange: 'orange',
  green: 'green',
  red: 'red'
};

const HEALTH_SCORE_COLOR = '#ffc107';

const IS_DESKTOP = window.innerWidth >= 768;
const IS_MOBILE = window.innerWidth < 768;

// Data is inlined at render time as window.__REPORT_DATA__ (see render.ts).
// It no longer fetches a separate data.json. The HTML is a single self-contained snapshot.
// After it lands in object storage it does not need a companion data file.
async function fetchData() {
  if (!window.__REPORT_DATA__) {
    throw new Error('Missing inline report data window.__REPORT_DATA__');
  }
  return window.__REPORT_DATA__;
}

function renderDate(header) {
  document.getElementById('date').textContent = `${header.date} ${header.weekday}`;
}

function renderHealthChart(healthScore) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById('healthChart');
  const myChart = echarts.init(chartDom);
  const percent = healthScore.score / healthScore.fullScore;
  const w = chartDom.clientWidth;
  const h = chartDom.clientHeight;
  const r = Math.min(w, h) * 0.75;
  const cx = w * 0.5;
  const cy = h * 0.52;

  const leftEndX = cx - r;
  const rightEndX = cx + r;
  const endY = cy;

  const offsetLeft = leftEndX - cx;
  const offsetRight = rightEndX - cx;
  const offsetY = endY - h;

  // console.log(1, 'w', w, offsetRight)
  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: '75%',
        center: ['50%', '52%'],
        pointer: { show: false },
        progress: {
          show: true,
          width: 10,
          roundCap: true,
          itemStyle: { color: 'rgba(255,255,255,0.25)' }
        },
        axisLine: { show: false },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: { show: false },
        data: [{ value: 100 }]
      },
      {
        type: 'gauge',
        startAngle: 180,
        endAngle: 0,
        min: 0,
        max: 100,
        radius: '75%',
        center: ['50%', '52%'],
        pointer: { show: false },
        progress: {
          show: true,
          width: 10,
          roundCap: true,
          itemStyle: { color: HEALTH_SCORE_COLOR }
        },
        axisLine: { show: false },
        splitLine: { show: false },
        axisTick: { show: false },
        axisLabel: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: false,
          offsetCenter: [0, '-8%'],
          fontSize: Math.round(32),
          fontWeight: 700,
          color: '#ffc107',
          formatter: () => `${healthScore.score}`
        },
        data: [{ value: percent * 100 }]
      }
    ],
    graphic: [
      {
        type: 'text',
        // left: 'center',
        // bottom: 0,
        style: {
          text: 'pts',
          fill: '#ffc107',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center'
        },
        position: IS_DESKTOP ? [90, 75] : [70, 60]
      },
      {
        type: 'text',
        // left: 'center',
        // bottom: 0,
        style: {
          text: '0',
          fill: 'rgba(255,255,255,0.7)',
          fontSize: 11,
          textAlign: 'center'
        },
        position: [30, 65]
      },
      {
        type: 'text',
        style: {
          text: '100',
          fill: 'rgba(255,255,255,0.7)',
          fontSize: 11,
          textAlign: 'center'
        },
        position: IS_DESKTOP ? [150, 65] : [110, 65]
      },
      {
        type: 'text',
        // left: 'center',
        // bottom: 0,
        style: {
          text: healthScore.change === null
            ? 'No comparison with yesterday'
            : healthScore.change > 0
            ? `Up ${healthScore.change} pts from yesterday`
            : healthScore.change < 0
              ? `Down ${Math.abs(healthScore.change)} pts from yesterday`
              : 'Unchanged from yesterday',
          fill: 'rgba(255,255,255,0.85)',
          fontSize: 11,
          textAlign: 'center'
        },
        position: IS_DESKTOP ? [90, 95] : [70, 75]
      },
      {
        type: 'text',
        // left: 'center',
        // bottom: 0,
        style: {
          text: 'Operating health',
          fill: 'rgba(255,255,255,0.9)',
          fontSize: 12,
          fontWeight: 600,
          textAlign: 'center'
        },
        position: IS_DESKTOP ? [90, 110] : [70, 88]
      }
    ]
  };

  myChart.setOption(option);

  window.addEventListener('resize', () => myChart.resize(), { passive: true });
}

function renderAIJudge(aiJudge) {
  const badge = document.getElementById('statusBadge');
  badge.textContent = aiJudge.status;
  badge.className = `status-badge ${STATUS_BG_MAP[aiJudge.statusColor] || 'orange'}`;

  const descEl = document.getElementById('judgeDesc');
  if (aiJudge.highlightParts && aiJudge.highlightParts.length) {
    let html = aiJudge.description;
    aiJudge.highlightParts.forEach(h => {
      html = html.split(h).join(`<span class="judge-highlight">${h}</span>`);
    });
    descEl.innerHTML = html;
  } else {
    descEl.textContent = aiJudge.description;
  }
}

function renderOverview(overview) {
  document.getElementById('overviewTitle').textContent = overview.title;

  const container = document.getElementById('indicators');
  container.innerHTML = overview.indicators.map(item => {
    const trendClass = item.sentiment || 'neutral';
    const arrow = item.trend === 'up' ? '↑' : item.trend === 'down' ? '↓' : '→';
    const comparison = item.change === null || item.change === undefined
      ? '<span class="no-baseline">No comparison</span>'
      : `<span class="arrow">${arrow}</span><span>${item.change}${item.changeUnit}</span>`;
    return `
      <div class="indicator-card">
        <div class="indicator-name">${item.name}</div>
        <div class="indicator-value">
          ${item.value}<span class="indicator-unit">${item.unit}</span>
        </div>
        ${item.supplementary ? `<div class="indicator-supplementary">${item.supplementary}</div>` : ''}
        <div class="indicator-change ${trendClass}">
          ${comparison}
        </div>
      </div>
    `;
  }).join('');
}

function renderSummary(summary) {
  document.getElementById('summaryTitle').textContent = summary.title;

  const container = document.getElementById('summaryContent');
  container.innerHTML = summary.paragraphs.map(p => {
    if (p.type === 'text') {
      if (p.highlightParts && p.highlightParts.length) {
        let html = p.highlightParts[0].text;
        p.highlightParts[0].highlight.forEach(h => {
          html = html.split(h).join(`<span style="color:#F5222D;font-weight:600;">${h}</span>`);
        });
        return `<p class="summary-paragraph">${html}</p>`;
      }
      return `<p class="summary-paragraph">${p.content}</p>`;
    }

    if (p.type === 'followUp' || p.type === 'alert' || p.type === 'risk') {
      return `
        <div class="summary-item-inline">
          <span class="item-icon">${p.icon}</span>
          <span class="item-dot" style="background:${p.dotColor};"></span>
          <span class="item-label" style="color:${p.labelColor};">${p.label}：</span>
          <span class="item-content-text">${p.content}</span>
        </div>
      `;
    }

    return '';
  }).join('');
}

function renderBottomStats(bottomStats) {
  const container = document.getElementById('bottomStats');
  container.innerHTML = bottomStats.map(item => `
    <div class="stat-card" style="background:${item.bg};border-color:${item.borderColor};">
      <div class="stat-row">
        <div class="stat-left">
          <span class="stat-emoji">${item.icon}</span>
          <span class="stat-title" style="color:${item.titleColor};">${item.title}</span>
        </div>
        <div class="stat-count" style="color:${item.countColor};">${item.count}<span class="stat-unit">${item.unit}</span></div>
      </div>
      <div class="stat-desc">${item.description}</div>
    </div>
  `).join('');
}

function renderBossFocus(bossFocus) {
  const container = document.getElementById('bossFocusList');
  container.innerHTML = bossFocus.map(item => {
    const contentsHtml = item.contents.map(c => {
      switch (c.type) {
        case 'big-number':
          return `
            <div class="boss-big-number">
              <div class="big-num" style="color:${item.headerColor};">${c.value}</div>
              <div class="big-num-label">${c.unit} · ${c.label}</div>
            </div>
          `;
        case 'section-title':
          return `<div class="boss-section-title">${c.text}</div>`;
        case 'highlight-card':
          return `
            <div class="boss-highlight-card">
              <div class="customer">${c.customer}</div>
              <div class="amount-row">
                <span class="amount" style="color:${item.headerColor};">${c.amount}</span>
                <span class="amount-unit">${c.amountUnit}</span>
              </div>
              <div class="tags">
                ${c.tags.map(t => `<span class="tag">${t}</span>`).join('')}
              </div>
            </div>
          `;
        case 'table':
          return `
            <div class="boss-table">
              <table>
                <thead>
                  <tr>
                    ${c.columns.map((h, i) => `<th class="${i === (c.highlightCol || -1) ? 'highlight' : ''}">${h}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${c.rows.map(row => `
                    <tr>
                      ${row.map((cell, i) => `<td class="${i === (c.highlightCol || -1) ? 'highlight' : ''}">${cell}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        case 'text':
          return `<div class="boss-text">${c.text}</div>`;
        case 'trend':
          return `
            <div class="boss-trend">
              <div class="boss-trend-title">${c.title}</div>
              <div id="${c.chartId}" class="boss-trend-chart"></div>
            </div>
          `;
        case 'bar-chart':
          return `
            <div class="boss-trend">
              <div class="boss-trend-title">${c.title}</div>
              <div id="${c.chartId}" class="boss-trend-chart"></div>
            </div>
          `;
        case 'suggestion':
          return `
            <div class="boss-suggestion" style="border:1px solid ${item.borderColor};">
              <div class="boss-suggestion-text" style="color:${item.headerColor};">
                <span class="boss-suggestion-label">Suggestion: </span>${c.text.replace(/^Suggestion: /, '')}
              </div>
            </div>
          `;
        default:
          return '';
      }
    }).join('');

    return `
      <div class="boss-item" style="background:${item.bg};border-color:${item.borderColor};">
        <div class="boss-item-header">
          <div class="boss-item-number" style="background:${item.headerColor};">${item.number}</div>
          <div class="boss-item-title" style="color:${item.headerColor};">${item.title}</div>
        </div>
        <div class="boss-item-subtitle">${item.subtitle}</div>
        ${contentsHtml}
      </div>
    `;
  }).join('');

  bossFocus.forEach(item => {
    item.contents.forEach(c => {
      if (c.type === 'trend') {
        renderTrendChart(c.chartId, c.data, item.headerColor);
      }
      if (c.type === 'bar-chart') {
        renderBarChart(c.chartId, c.data, item.headerColor);
      }
    });
  });
}

function renderTrendChart(chartId, data, color) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById(chartId);
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);

  const maxVal = Math.max(...data.values);
  const yMax = Math.ceil(maxVal * 1.2);

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        const item = params[0];
        const value = item.value === null || item.value === undefined
          ? 'No data'
          : `${item.value}${data.yUnit || ''}`;
        return `${item.axisValue}<br/>${item.marker}${value}`;
      }
    },
    grid: {
      left: 45,
      right: 20,
      top: 20,
      bottom: 30
    },
    xAxis: {
      type: 'category',
      data: data.dates,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#999', fontSize: 10 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      show: true,
      min: 0,
      max: yMax,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#999',
        fontSize: 10,
        formatter: data.yUnit ? '{value}' + data.yUnit : '{value}'
      },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        type: 'line',
        data: data.values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: color, width: 2 },
        itemStyle: { color: color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '40' },
              { offset: 1, color: color + '05' }
            ]
          }
        },
        label: {
          show: true,
          position: 'top',
          color: color,
          fontSize: 10,
          fontWeight: 600,
          formatter: function(params) {
            if (params.dataIndex === data.peakIndex) return data.peakLabel;
            if (params.dataIndex === data.values.length - 1) return data.endLabel;
            return '';
          }
        },
        markLine: { show: false }
      }
    ]
  };

  myChart.setOption(option);
}

function renderBarChart(chartId, data, color) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById(chartId);
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);

  const numericValues = data.values.filter(v => v !== null && v !== undefined).map(Number);
  const maxVal = Math.max(0, ...numericValues);
  const yMax = Math.max(1, Math.ceil(maxVal * 1.2));

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: function(params) {
        const item = params[0];
        const value = item.value === null || item.value === undefined
          ? 'No data'
          : `${item.value}${data.yUnit || ''}`;
        return `${item.axisValue}<br/>${item.marker}${value}`;
      }
    },
    grid: { left: 42, right: 10, top: 14, bottom: 28 },
    xAxis: {
      type: 'category',
      data: data.dates,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#999', fontSize: 10 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      show: true,
      min: 0,
      max: yMax,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#999',
        fontSize: 10,
        formatter: data.yUnit ? '{value}' + data.yUnit : '{value}'
      },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        type: 'bar',
        data: data.values,
        barMaxWidth: 24,
        itemStyle: {
          color: color,
          borderRadius: [4, 4, 0, 0]
        },
        label: {
          show: true,
          position: 'top',
          color: color,
          fontSize: 10,
          fontWeight: 600,
          formatter: function(params) {
            return params.value > 0 ? params.value + (data.yUnit || '') : '';
          }
        }
      }
    ]
  };

  myChart.setOption(option);
}

function renderBusinessChain(businessChain) {
  document.getElementById('chainTitle').textContent = businessChain.title;
  const grid = document.getElementById('chainGrid');

  grid.innerHTML = businessChain.sections.map((item) => {
    const metricsHtml = item.metrics.map(m => `
      <span class="chain-metric" style="color:${item.chartColor};">${m.value}</span>
      ${m.unit ? `<span class="chain-metric-unit">${m.unit}</span>` : ''}
    `).join('');

    return `
      <div class="chain-item">
        <div class="chain-item-header">
          <span class="chain-item-icon">${item.icon}</span>
          <span class="chain-item-title">${item.title}</span>
        </div>
        <div class="chain-metrics">${metricsHtml}</div>
        ${item.subInfo ? `<div class="chain-sub-info">${item.subInfo}</div>` : ''}
        <div id="${item.chartId}" class="chain-chart" aria-label="${item.title} trend, last 7 days"></div>
        <div class="chain-ai-text">${item.aiText}</div>
      </div>
    `;
  }).join('');

  businessChain.sections.forEach(item => {
    if (typeof echarts !== 'undefined') renderChainBarChart(item.chartId, item.chartData, item.chartColor);
  });
}

function renderChainBarChart(chartId, data, color) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById(chartId);
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);
  const values = data.values.map(value => {
    if (value === null || value === undefined) return null;
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  });
  const allZero = values.length > 0 && values.every(value => value === 0);

  const option = {
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      formatter: function(params) {
        const item = params[0];
        const value = item.value === null || item.value === undefined
          ? 'No data'
          : `${item.value}${data.yUnit || ''}`;
        return `${item.axisValue}<br/>${item.marker}${value}`;
      }
    },
    grid: { left: 34, right: 4, top: 18, bottom: 24 },
    xAxis: {
      type: 'category',
      data: data.dates,
      show: true,
      axisLine: { lineStyle: { color: '#D9D9D9' } },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        interval: 0,
        color: '#8C8C8C',
        fontSize: 9,
        margin: 7,
        formatter: value => value.slice(3)
      }
    },
    yAxis: {
      type: 'value',
      show: true,
      min: 0,
      max: allZero ? 1 : undefined,
      interval: allZero ? 1 : undefined,
      splitNumber: allZero ? 1 : 2,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        color: '#8C8C8C',
        fontSize: 9,
        formatter: function(value) {
          if (data.yUnit === 'CNY' && Math.abs(value) >= 1000) {
            return `${Number((value / 1000).toFixed(1))}k`;
          }
          return String(Number(value.toFixed(1)));
        }
      },
      splitLine: { show: true, lineStyle: { color: '#F0F0F0' } }
    },
    series: [
      {
        type: 'bar',
        data: values.map((v, i) => ({
          value: v,
          itemStyle: i === data.peakIndex ? {
            color: color,
            borderRadius: [3, 3, 0, 0]
          } : {
            color: color + '80',
            borderRadius: [3, 3, 0, 0]
          }
        })),
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'top',
          distance: 2,
          color: color,
          fontSize: 9,
          formatter: params => params.value === 0 || params.dataIndex === data.peakIndex
            ? String(params.value)
            : ''
        }
      }
    ]
  };

  myChart.setOption(option);
}

function renderBusinessRisk(businessRisk) {
  document.getElementById('riskTitle').textContent = businessRisk.title;
  document.getElementById('riskTrendTitle').textContent = businessRisk.trend.title;

  if (typeof echarts !== 'undefined') {
    renderRiskDonut(businessRisk.distribution);
    renderRiskTrend(businessRisk.trend);
  }

  const tbody = document.getElementById('riskTableBody');
  tbody.innerHTML = businessRisk.riskList.map((item) => {
    return `
      <div class="risk-table-row">
        <div class="rt-col rt-level">
          <span class="level-badge" style="background:${item.levelColor};">${item.level}</span>
        </div>
        <div class="rt-col rt-desc">${item.desc}</div>
        <div class="rt-col rt-scope">${item.scope}</div>
        <div class="rt-col rt-amount">${item.amount}</div>
        <div class="rt-col rt-owner">${item.owner || 'Unassigned'}</div>
      </div>
    `;
  }).join('');

}

function renderRiskDonut(dist) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById(dist.chartId);
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);

  const total = dist.data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    chartDom.innerHTML = '<div class="chart-empty">No operating risks identified</div>';
    return;
  }
  const option = {
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} items ({d}%)'
    },
    legend: {
      orient: 'vertical',
      right: 10,
      top: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#666', fontSize: 11 },
      formatter: function(name) {
        const item = dist.data.find(d => d.name === name);
        const pct = ((item.value / total) * 100).toFixed(0);
        return name + ' ' + item.value + ' items ' + pct + '%';
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['50%', '72%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: dist.data.map(d => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.color }
        }))
      }
    ],
    graphic: [
      {
        type: 'text',
        x: chartDom.clientWidth * 0.35,
        y: chartDom.clientHeight * 0.5,
        style: {
          text: total + ' items',
          textAlign: 'center',
          textVerticalAlign: 'middle',
          fill: '#333',
          fontSize: 14,
          fontWeight: 600
        }
      }
    ]
  };

  myChart.setOption(option);
}

function renderRiskTrend(trend) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById(trend.chartId);
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);

  const numericValues = trend.values.filter(v => v !== null && v !== undefined).map(Number);
  const maxVal = Math.max(0, ...numericValues);
  const yMax = Math.max(1, Math.ceil(maxVal * 1.15));
  const tickValues = trend.yLabels.map(l => parseFloat(l));
  const labelMap = {};
  tickValues.forEach((v, i) => { labelMap[v] = trend.yLabels[i]; });

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        const item = params[0];
        const value = item.value === null || item.value === undefined ? 'No data' : `${item.value} risks`;
        return `${item.axisValue}<br/>${item.marker}${value}`;
      }
    },
    grid: { left: 50, right: 10, top: 20, bottom: 25 },
    xAxis: {
      type: 'category',
      data: trend.dates,
      axisLine: { lineStyle: { color: '#ddd' } },
      axisLabel: { color: '#999', fontSize: 10 },
      axisTick: { show: false }
    },
    yAxis: {
      type: 'value',
      show: true,
      min: 0,
      max: yMax,
      interval: yMax / (trend.yLabels.length - 1),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: '#999',
        fontSize: 10,
        formatter: function(value) {
          if (labelMap[value] !== undefined) return labelMap[value];
          let nearest = tickValues[0];
          let minDiff = Math.abs(value - nearest);
          for (let i = 1; i < tickValues.length; i++) {
            const diff = Math.abs(value - tickValues[i]);
            if (diff < minDiff) { minDiff = diff; nearest = tickValues[i]; }
          }
          return labelMap[nearest] || value;
        }
      },
      splitLine: { lineStyle: { color: '#f0f0f0' } }
    },
    series: [
      {
        type: 'line',
        data: trend.values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#F5222D', width: 2 },
        itemStyle: { color: '#F5222D' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(245,34,45,0.3)' },
              { offset: 1, color: 'rgba(245,34,45,0.02)' }
            ]
          }
        },
        label: {
          show: true,
          position: 'top',
          color: '#F5222D',
          fontSize: 10,
          fontWeight: 600,
          formatter: function(params) {
            if (trend.peakIndex.includes(params.dataIndex)) {
              return trend.peakLabels[trend.peakIndex.indexOf(params.dataIndex)];
            }
            return '';
          }
        }
      }
    ]
  };

  myChart.setOption(option);
}

function renderRowTrend(chartId, values, color) {
  if (typeof echarts === 'undefined') return;
  const chartDom = document.getElementById(chartId);
  if (!chartDom) return;
  const myChart = echarts.init(chartDom);

  const option = {
    grid: { left: 2, right: 2, top: 3, bottom: 2 },
    xAxis: { type: 'category', show: false, data: values.map((_, i) => i) },
    yAxis: { type: 'value', show: false },
    series: [
      {
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: color, width: 1.5 },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '60' },
              { offset: 1, color: color + '05' }
            ]
          }
        }
      }
    ]
  };

  myChart.setOption(option);
}

function renderActionList(actionList) {
  document.getElementById('actionTitle').textContent = actionList.title;
  const container = document.getElementById('actionSections');
  container.innerHTML = actionList.sections.map(section => {
    const itemsHtml = section.items.map(item => `
      <div class="action-item">
        <div class="action-time">${item.time}</div>
        <div class="action-dot" style="background:${item.dotColor};"></div>
        <div class="action-content">
          <div class="action-person">${item.person}</div>
          <div class="action-task">${item.task}</div>
          <div class="action-evidence">Basis: ${item.evidence}</div>
        </div>
        <div class="action-level" style="background:${item.levelColor};">${item.level}</div>
      </div>
    `).join('');
    return `
      <div class="action-section">
        <div class="action-section-title">${section.title}</div>
        ${itemsHtml}
      </div>
    `;
  }).join('');
}

async function init() {
  try {
    const data = await fetchData();
    renderDate(data.header);
    renderAIJudge(data.aiJudge);
    renderOverview(data.overview);
    renderSummary(data.summary);
    renderBottomStats(data.bottomStats);
    renderBossFocus(data.bossFocus);
    renderBusinessChain(data.businessChain);
    renderBusinessRisk(data.businessRisk);
    renderActionList(data.actionList);
    // Charts are an enhancement. If the shared ECharts resource fails, the deterministic numbers, the AI analysis, and the action list must still be readable.
    if (typeof echarts === 'undefined') {
      document.body.classList.add('charts-unavailable');
      return;
    }
    renderHealthChart(data.healthScore);
  } catch (error) {
    const failure = document.createElement('p');
    failure.className = 'report-error';
    failure.textContent = `Failed to load data: ${error instanceof Error ? error.message : String(error)}`;
    document.body.appendChild(failure);
  }
}

init();

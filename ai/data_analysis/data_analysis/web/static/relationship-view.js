/* Interactive view of server-provided ontology / lineage. No synthetic nodes except
   explicitly missing endpoints, and no changes to the API or graph schema. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let sequence = 0;
  window.RelationshipView = {markup(graph, title, currentId) {
    return '<section class="relationship-view" data-graph="'+esc(JSON.stringify({graph,title,currentId}))+'"><p>正在绘制关系图…</p></section>';
  }};
  function mount(root) {
    if(root.dataset.ready) return;
    root.dataset.ready='true';
    let payload;
    try {payload=JSON.parse(root.dataset.graph)} catch {root.textContent='关系图数据无法读取';return}
    delete root.dataset.graph;
    const graph=payload.graph||{};
    const nodes=(graph.nodes||[]).map(n=>({...n,id:String(n.id??n.name??''),label:String(n.display_name||n.label||n.name||n.id||'')}));
    const edges=[...(graph.edges||[]).map(e=>({...e,broken:false})),...(graph.broken_edges||[]).map(e=>({...e,broken:true}))].map(e=>({...e,source:String(e.source),target:String(e.target)}));
    edges.forEach(e=>[e.source,e.target].forEach(id=>{if(!nodes.some(n=>n.id===id))nodes.push({id,label:id,missing:true})}));
    if(!nodes.length){root.innerHTML='<div class="relationship-empty"><h3>'+esc(payload.title)+'尚无节点</h3><p>注册业务对象和关系，或创建数据模型后重新加载。</p></div>';return}
    const uid='relationship-'+(++sequence);
    let selected=nodes.find(n=>n.id===String(payload.currentId)||n.current||n.is_current)?.id||nodes[0].id, zoom=1, layout='orbit', query='';
    root.innerHTML='<div class="relationship-toolbar"><label>搜索节点<input type="search" placeholder="对象名称或标识" aria-label="搜索关系图节点"></label><div><button type="button" data-graph-action="layout">切换层级布局</button><button type="button" data-graph-action="out" aria-label="缩小">−</button><output>100%</output><button type="button" data-graph-action="in" aria-label="放大">+</button><button type="button" data-graph-action="reset">复位</button></div></div><div class="relationship-body"><div class="relationship-stage"><h3>'+esc(payload.title)+'</h3><p>'+nodes.length+' 个节点 · '+edges.length+' 条关系'+(edges.some(e=>e.broken)?' · 虚线表示断边':'')+'</p><div class="relationship-scroll"><svg viewBox="0 0 900 620" role="group" aria-label="'+esc(payload.title)+'"></svg></div><p class="relationship-status" role="status"></p></div><aside class="relationship-inspector" aria-label="选中节点详情"></aside></div><details class="relationship-directory"><summary>全部节点与关系</summary><div class="relationship-list"></div></details>';
    const svg=root.querySelector('svg'), inspector=root.querySelector('aside'), viewport=root.querySelector('.relationship-scroll');
    const relations=n=>edges.filter(e=>e.source===n.id||e.target===n.id);
    function inspect(){
      const n=nodes.find(n=>n.id===selected);
      inspector.innerHTML='<span class="relationship-seal">'+esc(n.label.slice(0,1))+'</span><h3>'+esc(n.label)+'</h3><p>'+esc(n.id)+'</p>'+(n.missing?'<p class="relationship-warning">端点未注册，检查关系定义。</p>':'')+'<dl>'+Object.entries(n).filter(([k])=>!['id','label','current','is_current','missing'].includes(k)).map(([k,v])=>'<div><dt>'+esc(({display_name:'显示名称',primary_key:'主键',backed_by_table:'来源表',properties:'字段',type:'类型',name:'名称'})[k]||k)+'</dt><dd>'+esc(typeof v==='object'?JSON.stringify(v,null,2):v)+'</dd></div>').join('')+'</dl><h4>关联路径</h4><ul>'+relations(n).map(e=>'<li>'+esc(e.source)+' → '+esc(e.target)+'<small>'+esc([e.id,e.cardinality,e.source_join_key&&e.target_join_key?e.source_join_key+' → '+e.target_join_key:'',e.broken?'端点未注册':''].filter(Boolean).join(' · '))+'</small></li>').join('')+'</ul>'+(relations(n).length?'':'<p>暂无关联关系</p>');
    }
    function draw(){
      const positions=new Map();
      const rows=Math.ceil(nodes.length/4), radius=Math.max(290,nodes.length*18);
      const width=layout==='orbit'&&nodes.length>12?radius*2+220:900;
      const height=layout==='flow'?Math.max(620,rows*190+100):nodes.length>12?width:620;
      nodes.forEach((n,i)=>{
        let x,y;
        if(layout==='flow'){x=120+(i%4)*220;y=120+Math.floor(i/4)*190}
        else {const angle=-Math.PI/2+i*2*Math.PI/nodes.length;x=width/2+Math.cos(angle)*(nodes.length>12?radius:290);y=(nodes.length>12?height/2:290)+Math.sin(angle)*(nodes.length>12?radius:190);if(nodes.length===1){x=450;y=290}}
        positions.set(n.id,{x,y});
      });
      svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.style.width=(zoom*100)+'%';svg.style.minWidth=(zoom*100)+'%';svg.style.height=(Math.max(400,viewport.clientWidth*height/width)*zoom)+'px';
      const q=query.toLowerCase();let matches=0;
      svg.innerHTML='<defs><marker id="'+uid+'" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0L8 4L0 8" fill="#bca476"/></marker></defs><g class="relationship-orbits" aria-hidden="true"><ellipse cx="450" cy="300" rx="350" ry="245"/><ellipse cx="450" cy="300" rx="360" ry="165" transform="rotate(-25 450 300)"/></g>'+edges.map(e=>{
        const a=positions.get(e.source),b=positions.get(e.target);if(!a||!b)return '';
        const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
        const path=e.source===e.target?`M${a.x-25} ${a.y-39} C${a.x-100} ${a.y-145} ${a.x+100} ${a.y-145} ${a.x+25} ${a.y-39}`:`M${a.x+ux*48} ${a.y+uy*48}L${b.x-ux*53} ${b.y-uy*53}`;
        return '<g class="relationship-edge '+(e.source===selected||e.target===selected?'selected ':'')+(e.broken?'broken':'')+'"><path d="'+path+'" marker-end="url(#'+uid+')"/><text x="'+((a.x+b.x)/2)+'" y="'+((a.y+b.y)/2-12)+'">'+esc(({ONE_TO_MANY:'1 : N',MANY_TO_ONE:'N : 1',MANY_TO_MANY:'N : N',ONE_TO_ONE:'1 : 1'})[e.cardinality]||e.cardinality||e.id||'')+'</text></g>';
      }).join('')+nodes.map(n=>{
        const p=positions.get(n.id),hit=!q||(n.label+' '+n.id).toLowerCase().includes(q);if(hit)matches++;
        return '<g class="relationship-node '+(n.id===selected?'selected ':'')+(hit?'':'dim ')+(n.missing?'missing':'')+'" transform="translate('+p.x+' '+p.y+')" role="button" tabindex="0" aria-label="查看 '+esc(n.label)+'" aria-pressed="'+(n.id===selected)+'" data-node="'+esc(n.id)+'"><circle class="halo" r="53"/><circle r="45"/><text class="monogram" y="10">'+esc(n.label.slice(0,1))+'</text><text class="node-caption" y="79">'+esc(n.label.length>14?n.label.slice(0,13)+'…':n.label)+'</text><title>'+esc(n.label+' / '+n.id)+'</title></g>';
      }).join('');
      root.querySelector('output').textContent=Math.round(zoom*100)+'%';root.querySelector('.relationship-status').textContent=query?'找到 '+matches+' 个节点':'选中节点查看属性 · 箭头表示关系方向';
    }
    root.querySelector('.relationship-list').innerHTML='<ul>'+nodes.map(n=>'<li><button type="button" data-select-node="'+esc(n.id)+'">'+esc(n.label)+'</button> <span>'+esc(n.id)+'</span></li>').join('')+'</ul><ul>'+edges.map(e=>'<li>'+esc(e.source+' → '+e.target)+'<small>'+esc([e.id,e.cardinality,e.broken?'断边':''].filter(Boolean).join(' · '))+'</small></li>').join('')+'</ul>';
    root.addEventListener('click',e=>{
      const n=e.target.closest('[data-node],[data-select-node]');if(n){selected=n.dataset.node||n.dataset.selectNode;draw();inspect();return}
      const action=e.target.closest('[data-graph-action]')?.dataset.graphAction;
      if(!action)return;
      if(action==='layout'){layout=layout==='orbit'?'flow':'orbit';e.target.textContent=layout==='orbit'?'切换层级布局':'切换轨道布局'}
      if(action==='in')zoom=Math.min(3,zoom+.25);if(action==='out')zoom=Math.max(.75,zoom-.25);
      if(action==='reset'){zoom=1;query='';root.querySelector('input').value='';viewport.scrollTo(0,0)}
      draw();
    });
    root.addEventListener('keydown',e=>{const n=e.target.closest('[data-node]');if(n&&['Enter',' '].includes(e.key)){e.preventDefault();selected=n.dataset.node;draw();inspect();[...svg.querySelectorAll('[data-node]')].find(el=>el.dataset.node===selected)?.focus()}});
    root.querySelector('input').addEventListener('input',e=>{query=e.target.value;draw()});draw();inspect();
  }
  const observer=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(n=>{if(n.nodeType!==1)return;if(n.matches('.relationship-view'))mount(n);n.querySelectorAll('.relationship-view').forEach(mount)})));
  observer.observe(document.getElementById('mount'),{subtree:true,childList:true});
})();

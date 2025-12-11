/* wind.js — full hybrid wind tool with codal data, save/load, compare, PDF watermark */

// ---------------- CODE DATA (representative + extended lists) ----------------
// IS 875 basic wind speeds (Vb m/s) — representative set (extendable)
const IS_VB = {
  "Mumbai": 60, "Delhi": 55, "Bengaluru": 55, "Chennai": 50, "Hyderabad": 55,
  "Ahmedabad": 44, "Pune": 40, "Kolkata": 50, "Lucknow": 47, "Surat": 44,
  "Jaipur": 33, "Nagpur": 39, "Bhopal": 39, "Visakhapatnam": 50, "Thiruvananthapuram":39,
  "Rajkot":44, "Indore":39, "Ranchi":47, "Coimbatore":39, "Patna":47
  // you can extend with full codal list
}

// GCC / ASCE sample V (mph)
const GCC_V = { "Dubai": 110, "Abu Dhabi": 110, "Doha": 120, "Riyadh": 115, "Muscat": 110, "Manama": 110 }

// IS k1 table (simplified lookup)
// For production replace with exact codal k1 table mapping to return precise values
const IS_K1 = { "normal":1.00, "important":1.15, "critical":1.30 }

// IS k2 approximate by terrain category (should be replaced with full table)
const IS_K2 = { "1":0.95, "2":1.00, "3":1.05, "4":1.10 }

// Topography k3 (approx)
const IS_K3 = { "flat":1.0, "small-rise":1.05, "large-rise":1.10, "slope":1.20 }

// ASCE simple parameters: exposure factors mapping is rough for quick checks
const ASCE_EXPOSURES = { "B":0.7, "C":0.85, "D":1.03 }

// ---------- small helpers ----------
const id = (s)=>document.getElementById(s)
const canvas = id('chart'); const ctx = canvas.getContext('2d')

// Populate cities
function populateCitySelect(){
  const sel = id('citySelect'); sel.innerHTML = '<option value="">-- pick city --</option>'
  const optGroup = document.createElement('optgroup'); optGroup.label = "India (IS 875 Vb m/s)"
  Object.keys(IS_VB).sort().forEach(c=>{
    const o=document.createElement('option'); o.value = IS_VB[c]; o.text = `${c} — ${IS_VB[c]} m/s`; optGroup.appendChild(o)
  })
  sel.appendChild(optGroup)
  const opt2=document.createElement('optgroup'); opt2.label="GCC / ASCE (mph)"
  Object.keys(GCC_V).forEach(c=>{
    const o=document.createElement('option'); o.value=''; o.dataset.asce=GCC_V[c]; o.text=`${c} — ${GCC_V[c]} mph (ASCE/GCC tab)`; opt2.appendChild(o)
  })
  sel.appendChild(opt2)
}
populateCitySelect()

// Tab behaviour
document.querySelectorAll('.tab').forEach(t=>{
  t.addEventListener('click', ()=>{
    document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); t.classList.add('active')
    const code=t.dataset.code
    id('isSection').style.display = (code==='is') ? 'block' : 'none'
    id('asceSection').style.display = (code==='asce') ? 'block' : 'none'
    id('status').innerText = `Selected: ${code.toUpperCase()}`
  })
})

// mode radio
Array.from(document.querySelectorAll('input[name="mode"]')).forEach(r=>{
  r.addEventListener('change', ()=>{
    if(r.checked && r.value==='manual'){ id('manualInputs').style.display='block' } else if(r.checked){ id('manualInputs').style.display='none' }
  })
})

// city selector auto-fill
id('citySelect').addEventListener('change', function(){
  const opt = this.options[this.selectedIndex]
  if(!opt) return
  if(opt.dataset.asce){
    id('asce_V').value = opt.dataset.asce
    document.querySelector('.tab[data-code="asce"]').click()
  } else {
    if(opt.value) id('is_vb_internal')?.remove()
    id('is_vb') ? id('is_vb').value = opt.value : null
    document.querySelector('.tab[data-code="is"]').click()
  }
})

// ------------- Calculation functions -------------
function calcIS(){
  // Vb: prefer manual override if mode==manual
  const mode = document.querySelector('input[name="mode"]:checked').value
  let Vb = 0
  if(mode==='manual'){ const manUnit=id('man_unit').value, manV=parseFloat(id('man_v').value||0); Vb = manUnit==='ms'? manV : (manV*0.44704) } // mph->m/s
  else { Vb = parseFloat(id('citySelect').value) || parseFloat(id('is_vb')?.value||0) }
  const k1 = parseFloat(id('is_k1').value) || 1.0
  const k2 = parseFloat(id('is_k2').value) || 1.0
  const k3 = parseFloat(id('is_k3').value) || 1.0
  const k4 = parseFloat(id('is_k4').value) || 1.0
  const H = parseFloat(id('height').value) || 0
  const Vz = Vb * k1 * k2 * k3 * k4
  const Pd = 0.6 * Vz * Vz   // N/m2 (approx)
  const points = profilePoints(Vz, H, 'is')
  return {code:'IS 875', Vb:round(Vb,2), Vz:round(Vz,2), Pd:round(Pd,2), H, points}
}

function calcASCE(){
  const mode = document.querySelector('input[name="mode"]:checked').value
  let V = 0
  if(mode==='manual'){ const manUnit=id('man_unit').value, manV=parseFloat(id('man_v').value||0); V = manUnit==='mph'? manV : (manV*2.23694) } // m/s->mph
  else { const opt = id('citySelect').options[id('citySelect').selectedIndex]; if(opt && opt.dataset.asce) V = parseFloat(opt.dataset.asce); else V = parseFloat(id('asce_V').value||0) }
  const exposure = parseFloat(id('asce_exp').value) || 0.85
  const kd = parseFloat(id('asce_kd').value) || 0.85
  const kzt = parseFloat(id('asce_kzt').value) || 1.0
  const H = parseFloat(id('height').value) || 0
  // qz (psf) formula simplified
  const qz_psf = 0.00256 * V * V * exposure * kd * kzt
  const qz_n = qz_psf * 47.880258
  const points = profilePoints(qz_n, H, 'asce')
  return {code:'ASCE/GCC', V:round(V,2), qz_psf:round(qz_psf,4), qz_n:round(qz_n,2), H, points}
}

// profilePoints: creates arrays of {z,pd} for plotting
function profilePoints(baseVal, H, type){
  const pts=[]; const steps = Math.max(6, Math.ceil(H/2))
  for(let i=0;i<=steps;i++){
    const z = Math.round((H*(i/steps))*10)/10
    let pd = 0
    if(type==='is'){
      // baseVal = Vz; convert inside
      const Vz = baseVal
      const Vz_z = Vz * Math.pow(1 + 0.05 * Math.min(z/10,4), 0.6)
      pd = 0.6 * Vz_z * Vz_z
    } else {
      // baseVal is qz in N/m2
      pd = baseVal * (1 + 0.03*(z/10))
    }
    pts.push({z:round(z,2), pd: round(pd,2)})
  }
  return pts
}

// ---------------- Charting ----------------
function clearChart(){ ctx.clearRect(0,0,canvas.width,canvas.height); id('summary').innerText='Cleared'; id('status').innerText='Ready' }

function drawChart(datasets){
  clearChart()
  // compute ranges
  let maxZ=1, maxP=1; datasets.forEach(ds=> ds.points.forEach(p=>{ if(p.z>maxZ) maxZ=p.z; if(p.pd>maxP) maxP=p.pd }))
  if(maxZ<10) maxZ=10
  // draw grid + axes
  const w=canvas.width, h=canvas.height, padL=50, padR=20, padT=20, padB=40
  ctx.font='12px Arial'
  // horizontal grid (pressure)
  const rows=5
  for(let i=0;i<=rows;i++){
    const y = padT + (h-padT-padB)*(i/rows)
    ctx.strokeStyle='#eef6ff'; ctx.beginPath(); ctx.moveTo(padL,y); ctx.lineTo(w-padR,y); ctx.stroke()
    const val = Math.round(maxP*(1 - i/rows))
    ctx.fillStyle='#6b7280'; ctx.fillText(val+' N/m²',8,y+4)
  }
  // vertical grid (height)
  const cols=5
  for(let j=0;j<=cols;j++){
    const x = padL + (w-padL-padR)*(j/cols)
    const z = Math.round(maxZ*(j/cols))
    ctx.fillStyle='#6b7280'; ctx.fillText(z+' m', x-10, h-padB+16)
    ctx.strokeStyle='#f0f6fb'; ctx.beginPath(); ctx.moveTo(x,padT); ctx.lineTo(x,h-padB); ctx.stroke()
  }
  // plot each dataset
  datasets.forEach((ds,idx)=>{
    const col = ds.color || (idx%2? '#0b74d1':'#10b981')
    ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath()
    ds.points.forEach((p,i)=>{
      const x = padL + (w-padL-padR)*(p.z/maxZ)
      const y = padT + (h-padT-padB)*(1 - p.pd/maxP)
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y)
    })
    ctx.stroke()
    // legend
    ctx.fillStyle = col; ctx.fillRect(w-160, 18 + idx*18, 8,8); ctx.fillStyle='#0f172a'; ctx.fillText(ds.label, w-148, 26 + idx*18)
  })
}

// ---------- Compare (overlay) ----------
function doCompare(){
  const isRes = calcIS(); const asRes = calcASCE()
  // create uniform Z samples
  const maxZ = Math.max(isRes.points[isRes.points.length-1].z, asRes.points[asRes.points.length-1].z)
  const sampleZ = []; const steps=12
  for(let i=0;i<=steps;i++) sampleZ.push(Math.round(maxZ*(i/steps)))
  function interp(arr,z){
    if(z<=arr[0].z) return arr[0].pd
    if(z>=arr[arr.length-1].z) return arr[arr.length-1].pd
    for(let i=0;i<arr.length-1;i++){
      if(arr[i].z<=z && arr[i+1].z>=z){
        const t=(z-arr[i].z)/(arr[i+1].z-arr[i].z); return arr[i].pd + t*(arr[i+1].pd-arr[i].pd)
      }
    }
    return arr[arr.length-1].pd
  }
  const ds = [
    {label:isRes.code, points: sampleZ.map(z=>({z, pd: round(interp(isRes.points,z),2)})), color:'#0b74d1'},
    {label:asRes.code, points: sampleZ.map(z=>({z, pd: round(interp(asRes.points,z),2)})), color:'#f97316'}
  ]
  drawChart(ds); id('summary').innerText='Comparison: IS 875 vs ASCE/GCC'; id('status').innerText='Calculated: Compare'
}

// ---------- Save / Load Cases (localStorage) ----------
const STORAGE_KEY = 'cd_wind_cases'
function loadCases(){ try{ const raw=localStorage.getItem(STORAGE_KEY); return raw? JSON.parse(raw): [] } catch(e){ return [] } }
function saveCases(list){ localStorage.setItem(STORAGE_KEY, JSON.stringify(list)) }
function refreshCasesUI(){
  const sel = id('savedCases'); sel.innerHTML = '<option value="">-- saved cases --</option>'
  const list = loadCases()
  list.forEach((c,i)=> { const o=document.createElement('option'); o.value=i; o.text = `${c.name} • ${new Date(c.time).toLocaleString()}`; sel.appendChild(o) })
}
function saveCurrentCase(){
  const name = id('caseName').value.trim(); if(!name){ alert('Enter case name'); return }
  const mode = document.querySelector('input[name="mode"]:checked').value
  const tab = document.querySelector('.tab.active').dataset.code
  const obj = {
    name, time: new Date().toISOString(),
    mode, tab,
    inputs:{
      city: id('citySelect').value || '',
      height: id('height').value,
      man_v: id('man_v')?.value || '',
      man_unit: id('man_unit')?.value || '',
      is_k1: id('is_k1').value, is_k2: id('is_k2').value, is_k3: id('is_k3').value, is_k4: id('is_k4').value, is_w: id('is_w').value, is_l: id('is_l').value,
      asce_V: id('asce_V').value, asce_exp: id('asce_exp').value, asce_kd: id('asce_kd').value, asce_kzt: id('asce_kzt').value
    }
  }
  const list = loadCases(); list.push(obj); saveCases(list); refreshCasesUI(); id('caseName').value=''; alert('Saved locally')
}
function loadCase(){
  const idx = id('savedCases').value; if(idx===''){ alert('Select saved case'); return }
  const list = loadCases(); const c = list[Number(idx)]
  if(!c) return
  // apply
  document.querySelectorAll('.tab').forEach(t=> t.classList.remove('active'))
  document.querySelector(`.tab[data-code="${c.tab}"]`).classList.add('active')
  id('height').value = c.inputs.height || ''
  if(c.mode==='manual'){ document.querySelector('input[name="mode"][value="manual"]').checked = true; id('manualInputs').style.display='block' }
  else { document.querySelector('input[name="mode"][value="auto"]').checked = true; id('manualInputs').style.display='none' }
  id('is_k1').value = c.inputs.is_k1 || '1.0'; id('is_k2').value = c.inputs.is_k2 || '1.0'; id('is_k3').value = c.inputs.is_k3 || '1.0'; id('is_k4').value = c.inputs.is_k4 || '1.0'
  id('is_w').value = c.inputs.is_w || '12'; id('is_l').value = c.inputs.is_l || '20'
  id('asce_V').value = c.inputs.asce_V || ''
  id('citySelect').value = c.inputs.city || ''
  id('status').innerText = `Loaded: ${c.name}`
}
function deleteCase(){
  const idx = id('savedCases').value; if(idx===''){ alert('Select saved case'); return }
  if(!confirm('Delete selected case?')) return
  const list = loadCases(); list.splice(Number(idx),1); saveCases(list); refreshCasesUI(); alert('Deleted')
}

// ---------- PDF export (with watermark) ----------
async function exportPDF(){
  id('status').innerText = 'Preparing PDF...'
  // build clone of summary + chart into offscreen div
  const wrapper = document.createElement('div'); wrapper.style.width='900px'; wrapper.style.padding='18px'; wrapper.style.fontFamily='Arial'
  const title = `<h2 style="margin:0 0 8px">CivilDoctor — Wind Report</h2><div style="margin-bottom:8px"><strong>Generated:</strong> ${new Date().toLocaleString()}</div>`
  const sum = id('summary').innerText || 'No summary'
  const chartImg = canvas.toDataURL('image/png')
  wrapper.innerHTML = `${title}<div style="margin-bottom:10px"><strong>Summary</strong><pre style="background:#f6f8fb;padding:8px;border-radius:6px">${sum}</pre></div><div><img src="${chartImg}" style="width:860px;border:1px solid #eee"></div><div style="margin-top:12px;color:#6b7280;font-size:12px">Generated by CivilDoctor</div>`
  document.body.appendChild(wrapper)
  try{
    const canvasImg = await html2canvas(wrapper, {scale:2})
    const imgData = canvasImg.toDataURL('image/png')
    const { jsPDF } = window.jspdf
    const pdf = new jsPDF({ unit:'pt', format:'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth(); const pageHeight = pdf.internal.pageSize.getHeight()
    const imgProps = pdf.getImageProperties(imgData)
    const imgWidth = pageWidth - 40; const imgHeight = (imgProps.height * imgWidth)/imgProps.width
    pdf.addImage(imgData,'PNG',20,20,imgWidth,imgHeight)
    // add watermark bottom-right
    pdf.setFontSize(10); pdf.setTextColor(150); pdf.text('CivilDoctor — www.civildoctor.example', pageWidth-220, pageHeight-20)
    pdf.save(`CivilDoctor_WindReport_${(new Date()).toISOString().slice(0,19).replace(/[:T]/g,'-')}.pdf`)
  } catch(e){
    alert('PDF failed: '+e.message)
  } finally { document.body.removeChild(wrapper); id('status').innerText='PDF Ready' }
}

// ---------- CSV export ----------
function exportCSVFromPoints(points, filename='wind_profile.csv'){
  let csv='height_m,pressure_N_per_m2\n'; points.forEach(p=> csv += `${p.z},${p.pd}\n`)
  const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob)
  const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url)
}

// ---------- Diagram draw ----------
function drawDiagram(points){
  const container = id('diagram'); container.innerHTML=''
  const svgNS='http://www.w3.org/2000/svg'
  const svg=document.createElementNS(svgNS,'svg'); svg.setAttribute('viewBox','0 0 500 200'); svg.setAttribute('width','100%')
  const maxP=Math.max(...points.map(p=>p.pd),1)
  points.forEach((p,i)=>{
    const y = 20 + (i/(points.length-1||1))*150
    const len = Math.min(360, (p.pd/maxP)*360)
    const rect=document.createElementNS(svgNS,'rect'); rect.setAttribute('x',100); rect.setAttribute('y',y-8); rect.setAttribute('width',len); rect.setAttribute('height',14); rect.setAttribute('fill','#0b74d1'); svg.appendChild(rect)
    const txt=document.createElementNS(svgNS,'text'); txt.setAttribute('x',16); txt.setAttribute('y',y+4); txt.setAttribute('fill','#0f172a'); txt.setAttribute('font-size','12'); txt.textContent = p.z + ' m'
    svg.appendChild(txt)
  })
  container.appendChild(svg)
}

// ---------- helpers ----------
function round(v, d=2){ return Math.round(v * (10**d))/(10**d) }

// ---------- UI wiring ----------
id('isCalc').addEventListener('click', ()=>{
  const res = calcIS(); drawChart([{label:res.code, points:res.points, color:'#0b74d1'}])
  id('summary').innerText = `${res.code} • Vb=${res.Vb} m/s → Vz=${res.Vz} m/s • Pd ≈ ${res.Pd} N/m²`
  id('status').innerText = 'Calculated: IS 875'
})
id('asceCalc').addEventListener('click', ()=>{
  const res = calcASCE(); drawChart([{label:res.code, points:res.points, color:'#f97316'}])
  id('summary').innerText = `${res.code} • V=${res.V} mph → qz ≈ ${res.qz_psf} psf (~${res.qz_n} N/m²)`
  id('status').innerText = 'Calculated: ASCE/GCC'
})
id('compareBtn').addEventListener('click', ()=> doCompare())
id('compareBtn2').addEventListener('click', ()=> doCompare())
id('downloadChart').addEventListener('click', ()=> {
  const link=document.createElement('a'); link.href = canvas.toDataURL('image/png'); link.download='wind_chart.png'; link.click()
})
id('drawDiag').addEventListener('click', ()=>{
  const s = id('status').innerText
  if(s.includes('IS')) drawDiagram(calcIS().points)
  else if(s.includes('ASCE')) drawDiagram(calcASCE().points)
  else if(s.includes('Compare')) { drawDiagram(calcIS().points); drawDiagram(calcASCE().points) }
  else alert('Run a calculation first.')
})
id('exportCsv').addEventListener('click', ()=>{
  const s = id('status').innerText
  if(s.includes('IS')) exportCSVFromPoints(calcIS().points, 'is_profile.csv')
  else if(s.includes('ASCE')) exportCSVFromPoints(calcASCE().points, 'asce_profile.csv')
  else alert('No calculation to export')
})
id('exportPdf').addEventListener('click', ()=> exportPDF())
id('copySummary').addEventListener('click', ()=> { navigator.clipboard.writeText(id('summary').innerText||''); alert('Summary copied') })

// Save/load UI
id('saveCase').addEventListener('click', ()=> saveCurrentCase())
id('loadCase').addEventListener('click', ()=> loadCase())
id('deleteCase').addEventListener('click', ()=> deleteCase())

// init canvas crispness + defaults
(function init(){
  const ratio = window.devicePixelRatio||1; canvas.width = Math.floor(canvas.clientWidth * ratio); canvas.height = Math.floor(canvas.clientHeight * ratio); ctx.setTransform(ratio,0,0,ratio,0,0)
  document.querySelector('.tab[data-code="is"]').click()
  refreshCasesUI()
})()

const TAX = 1.15; // 10% tax + 5% service charge

function cFmt(usdAmt, decimals=0){
  const code=window.offerCurrency||'USD';
  const rate=window.offerCurrencyRate||1;
  return `${code} ${fmtN(usdAmt*rate,decimals)}`;
}

function pricing(){
  const bales=parseInt($('f-rooms').value)||0, roomRate=parseFloat($('f-roomrate').value)||60;
  const pkgRate=parseFloat($('f-pkgrate')?.value)||30.25, pkgCount=parseInt($('f-pkgcount').value)||0;
  const discPct=Math.min(20,Math.max(0,parseFloat($('f-discount').value)||0));
  const parvOn=$('f-parvati-on').checked, parvOrig=parseFloat($('f-parvati-orig').value)||80;
  const parvDiscPct=parseFloat($('f-parvati-disc')?.value)||0; const parvDisc=parvDiscPct>0?parvOrig*(1-parvDiscPct/100):parvOrig;
  const buddOn=$('f-buddha-on').checked, buddOrig=parseFloat($('f-buddha-orig').value)||80;
  const buddDiscPct=parseFloat($('f-buddha-disc')?.value)||0; const buddDisc=buddDiscPct>0?buddOrig*(1-buddDiscPct/100):buddOrig;
  const discRooms=parseInt($('f-disc-room').value)||0, discRoomPct=Math.min(50,Math.max(0,parseFloat($('f-disc-pct').value)||0));
  const villaTotal=(parvOn?parvDisc:0)+(buddOn?buddDisc:0);
  const accomSub=bales*roomRate+villaTotal, pkgSub=pkgCount*pkgRate, stdSub=accomSub+pkgSub;
  const earlyAmt=discPct>0?stdSub*(discPct/100):0;
  const roomDiscAmt=discRooms>0&&discRoomPct>0?roomRate*(discRoomPct/100)*discRooms:0;
  const perNight=stdSub-earlyAmt-roomDiscAmt, perNightTax=perNight*TAX;
  const nights=parseInt($('f-nights').value)||7, totalEx=perNight*nights, totalIn=perNightTax*nights;
  return{bales,roomRate,pkgRate,pkgCount,discPct,parvOn,parvOrig,parvDisc,parvDiscPct,buddOn,buddOrig,buddDisc,buddDiscPct,discRooms,discRoomPct,villaTotal,accomSub,pkgSub,stdSub,earlyAmt,roomDiscAmt,perNight,perNightTax,nights,totalEx,totalIn};
}

function payments(total,checkin,depositPct){
  const d=depositPct>0?depositPct/100:0.5, rem=1-d;
  return{
    dep:{pct:Math.round(d*100)+'%',amt:total*d,due:fmtDS(addDays(todayStr(),2))},
    p2:{pct:Math.round(rem*0.6*100)+'%',amt:total*rem*0.6,due:checkin?fmtDS(addMonths(checkin,-3)):'___________'},
    p3:{pct:Math.round(rem*0.4*100)+'%',amt:total*rem*0.4,due:checkin?fmtDS(checkin):'___________'},
  };
}

function getFormState(){
  const ids=['f-name','f-company','f-address','f-phone','f-website','f-title','f-intro','f-body','f-checkin','f-checkout','f-contractdate','f-validuntil','f-retreatname','f-guests','f-facilitators','f-nights','f-rooms','f-bookingtype','f-parvati-orig','f-parvati-disc','f-buddha-orig','f-buddha-disc','f-roomrate','f-pkgrate','f-pkgcount','f-discount','f-disc-room','f-disc-pct','f-offervalid','f-deposit','f-idrrate','f-currency','f-note','f-included','f-also','f-signoff','f-signoff2'];
  const s={};
  ids.forEach(id=>{const el=$(id);if(el)s[id]=el.value;});
  s['f-parvati-on']=$('f-parvati-on').checked;
  s['f-buddha-on']=$('f-buddha-on').checked;
  s['extra-services']=getExtraServicesState();
  s['price-display']=document.querySelector('input[name="price-display"]:checked')?.value||'both';
  if (window._linkedLeadId) { s['_linkedLeadId'] = window._linkedLeadId; s['_linkedLeadName'] = window._linkedLeadName || ''; }
  return s;
}

function setFormState(s){
  Object.entries(s).forEach(([id,val])=>{const el=$(id);if(!el)return;if(el.type==='checkbox')el.checked=val;else el.value=val;});
  const r=document.querySelector(`input[name="price-display"][value="${s['price-display']||'both'}"]`);
  if(r)r.checked=true;
  ['parvati','buddha'].forEach(n=>$(`${n}-fields`).classList.toggle('disabled',!$(`f-${n}-on`).checked));
  if(s['extra-services'])setExtraServicesState(s['extra-services']);
  if(s['f-currency']&&typeof onCurrencyChange==='function')onCurrencyChange(s['f-currency']);
}

function buildOfferHTML(){
  const name=$('f-name').value||'', company=$('f-company').value, address=$('f-address').value;
  const intro=$('f-intro').value.trim(), guests=parseInt($('f-guests').value)||10, facilitators=parseInt($('f-facilitators').value)||0;
  const retreatName=$('f-retreatname').value||'Healing Retreat', noteText=$('f-note').value.trim();
  const offerValid=$('f-offervalid').value, depositPct=Math.min(100,Math.max(0,parseFloat($('f-deposit').value)||0));
  const checkin=$('f-checkin').value, checkout=$('f-checkout').value;
  const P=pricing(), totalPeople=guests+facilitators, days=P.nights+1;
  const monthStr=new Date().toLocaleDateString('en-GB',{month:'long',year:'numeric'});
  const offerValidStr=fmtD(offerValid), hasEB=P.discPct>0;
  const depositAmt=depositPct>0?(P.totalIn+extraServicesTotal()*TAX)*(depositPct/100):0;
  const introPara=intro.split(/\n+/).filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('');
  const noteRes=noteText.replace(/\{guests\}/g,totalPeople);
  const notePara=noteRes.split(/\n+/).filter(l=>l.trim()).map(l=>`<p>${l}</p>`).join('');
  const vNames=[P.parvOn?'Parvati Villa':'',P.buddOn?'Buddha Villa':''].filter(Boolean);
  const vBody=vNames.length>0?` We are pleased to include ${vNames.join(' and ')} in this package.`:'';
  const bodyText=$('f-body')?.value.trim()||'Kindly open the attached brochure for pictures of the full property.';
  const nights=P.nights;

  // ── PDF-style three-column pricing table ──────────────────────────────────
  const extTotal=extraServicesTotal();
  const hasExtras=extraServices.length>0;
  const grandEx=P.totalEx+extTotal, grandIn=P.totalIn+extTotal*TAX;

  // Row builder: item | rate/night (with optional strikethrough) | subtotal
  const pRow3=(label, rateOrig, rateDisc, discPctLabel, subtotal)=>{
    const rateCell = rateOrig && rateDisc && rateOrig!==rateDisc
      ? `<span class="rate-orig">${cFmt(rateOrig,0)}</span><span class="rate-disc">${cFmt(rateDisc,0)}<span class="rate-pct">-${discPctLabel}</span></span>`
      : `<span class="rate-disc">${cFmt(rateDisc||rateOrig,0)}</span>`;
    return `<tr class="pt-item"><td class="col-item">${label}</td><td class="col-rate">${rateCell}</td><td class="col-sub">${subtotal}</td></tr>`;
  };
  const pDiscRow=(label,amt)=>`<tr class="pt-discount"><td class="col-item"><strong>${label}</strong></td><td class="col-rate"></td><td class="col-sub" style="color:#C5A27D;font-weight:600;">${amt}</td></tr>`;

  // Accommodation rows
  const baleRow=P.bales<=0?'':P.bales<=5
    ?pRow3(`${P.bales} Gladak${P.bales>1?'s':''}`,null,P.roomRate,null,cFmt(P.bales*P.roomRate,2))
    :pRow3('5 Gladaks',null,P.roomRate,null,cFmt(5*P.roomRate,2))
     +pRow3(`${P.bales-5} Partner Hotel Room${P.bales-5>1?'s':''}`,null,P.roomRate,null,cFmt((P.bales-5)*P.roomRate,2));
  const parvRow=P.parvOn?pRow3('Parvati Villa',P.parvDiscPct>0?P.parvOrig:null,P.parvDisc,P.parvDiscPct>0?P.parvDiscPct+'%':null,cFmt(P.parvDisc,2)):'';
  const buddRow=P.buddOn?pRow3('Buddha Villa',P.buddDiscPct>0?P.buddOrig:null,P.buddDisc,P.buddDiscPct>0?P.buddDiscPct+'%':null,cFmt(P.buddDisc,2)):'';
  const pkgRow=P.pkgCount>0?pRow3(`Additional cost per person (Meals, Shala, Staff) — ${P.pkgCount} people`,null,P.pkgRate,null,cFmt(P.pkgSub,2)):'';

  // Subtotal row (before discounts)
  const subtotalRow=`<tr class="pt-subtotal"><td class="col-item">SUBTOTAL</td><td class="col-rate"></td><td class="col-sub" style="color:#3D3935;font-weight:600;">${cFmt(P.stdSub,2)}</td></tr>`;

  // Discount rows
  const ebRow=hasEB?pDiscRow(`${P.discPct}% Early Bird Discount`,`– ${cFmt(P.earlyAmt,2)}`):'';
  const rdRow=P.discRooms>0&&P.discRoomPct>0?pDiscRow(`${P.discRooms} Room${P.discRooms>1?'s':''} — ${P.discRoomPct}% Special Rate`,`– ${cFmt(P.roomDiscAmt,2)}`):'';

  // Extra service rows
  const extItemRows=hasExtras?extraServices.map(s=>{
    if(s.pricingEngine){const t=getIdrRate()>0?(s.spppIdr*s.pax)/getIdrRate():0;return pRow3(`${s.label} (${s.pax} pax)`,null,getIdrRate()>0?s.spppIdr/getIdrRate():0,null,cFmt(t,0));}
    const t=s.unitUsd*s.qty;const qtyStr=s.unit==='flat fee'?'':' × '+s.qty;
    return pRow3(`${s.label}${qtyStr}`,null,s.unitUsd,null,cFmt(t,0));
  }).join(''):'';

  const includedLines=($('f-included')?.value.trim()||'2 plant based meals per day\nTea & afternoon snack\nShala of your choice + cleaning\nFull staff support\nDedicated contact person').split(/\n+/).filter(l=>l.trim());
  const alsoLines=($('f-also')?.value.trim()||'Ayurvedic or Balinese menus available on request.\nDay trips and activities around Bali can be arranged.\nMassages, rituals, and photography available.\nAirport pick-up available on request.').split(/\n+/).filter(l=>l.trim());
  const signoff=$('f-signoff')?.value.trim()||'Andréa and Tari';
  const ebBadge=hasEB?`<div style="background:#FAF6F0;border:1px solid #C5A27D;border-radius:3px;padding:8px 12px;margin:10px 0;font-size:11px;color:#7A6248;text-align:center;"><strong>${P.discPct}% Early Bird Discount applied</strong> &nbsp;·&nbsp; Book by ${offerValidStr} to secure this rate.</div>`:'';
  const validLine=offerValid?`<p>This offer is valid until ${offerValidStr}.</p>`:'';
  const depositLine=depositPct>0?`<p>To secure the property's shala and rooms, a <strong>non-refundable deposit of ${depositPct}% (${cFmt(depositAmt,0)})</strong> of the total investment is required upon booking confirmation.</p>`:'';

  return `<div class="contract-doc">
  <div class="c-hd">
    <img src="https://images.squarespace-cdn.com/content/v1/601cf6a4fabc2a27672c7e92/1612600900318-S8C53NTKP4MK405H0BTU/Ubuntu+logo+9-12-20-09.png?format=400w" style="height:44px;display:block;margin:0 auto 14px;filter:brightness(0) sepia(1) saturate(3) hue-rotate(5deg) brightness(.35);">
    <div class="c-hd-title">Retreat Hosting Offer</div>
    <div class="c-hd-sub">Ubuntu Bali &nbsp;·&nbsp; ${monthStr}</div>
  </div>
  ${name||company?`<div class="c-parties" style="margin-bottom:20px;"><div class="c-party" style="border-right:none;"><div class="c-party-title">Prepared for</div>${company?`<p>${company}</p>`:''}${name?`<p>Attn: ${name}</p>`:''}${address?`<p>${address}</p>`:''}${fmtD(checkin)&&fmtD(checkout)?`<p>Dates: ${fmtD(checkin)} — ${fmtD(checkout)}</p>`:''}</div></div>`:''}
  <div class="c-sec">
    ${introPara||`<p>Please find below our retreat hosting offer for <strong>${retreatName}</strong>.</p>`}
    <p>${vBody}${hasEB?` We have applied a <strong>${P.discPct}% early booking discount</strong> — valid if you confirm your booking by ${offerValidStr}.`:''} ${bodyText}</p>
  </div>
  <div class="c-sec">
    <div class="c-sec-hd">Package &amp; Pricing</div>
    <p><strong>${retreatName}</strong> &nbsp;·&nbsp; ${nights} Nights, ${days} Days &nbsp;·&nbsp; ${totalPeople} Guests</p>
    ${fmtDS(checkin)&&fmtDS(checkout)?`<p>Check-in: ${fmtDS(checkin)} &nbsp;·&nbsp; Check-out: ${fmtDS(checkout)}</p>`:''}
    ${ebBadge}
    <div class="e-package" style="margin:12px 0 0;">
      <table class="ptable">
        <thead><tr class="pt-colhead"><td class="col-item">ITEM</td><td class="col-rate">RATE / NIGHT</td><td class="col-sub">SUBTOTAL</td></tr></thead>
        <tbody>${baleRow}${parvRow}${buddRow}${pkgRow}${subtotalRow}${ebRow}${rdRow}</tbody>
      </table>
      ${hasExtras?`<table class="ptable" style="margin-top:10px;">
        <thead><tr class="pt-colhead"><td class="col-item">ENHANCEMENTS</td><td class="col-rate"></td><td class="col-sub">TOTAL</td></tr></thead>
        <tbody>${extItemRows}</tbody>
      </table>`:''}
      <div class="e-investment" style="margin-top:14px;">
        <div class="e-invest-row" style="border-bottom:1px solid #E2D9CE;padding-bottom:8px;">
          <span>Package Total (${nights} Nights) <span style="font-size:8.5px;color:#9E948A;">excl. tax &amp; service fee</span></span>
          <span style="font-size:13px;font-weight:600;color:#3D3935;">${cFmt(hasExtras?grandEx:P.totalEx,0)}</span>
        </div>
        <div class="e-invest-row" style="padding:6px 0 2px;">
          <span style="color:#9E948A;">10% Tax</span>
          <span style="color:#9E948A;">${cFmt((hasExtras?grandEx:P.totalEx)*0.10,2)}</span>
        </div>
        <div class="e-invest-row" style="padding:2px 0 8px;border-bottom:1px solid #E2D9CE;">
          <span style="color:#9E948A;">5% Service Charge</span>
          <span style="color:#9E948A;">${cFmt((hasExtras?grandEx:P.totalEx)*0.05,2)}</span>
        </div>
        <div class="e-invest-grand">
          <div>
            <div class="e-invest-grand-lbl">Total Investment</div>
            <div class="e-invest-grand-sub">incl. tax &amp; service charge</div>
          </div>
          <div style="text-align:right;">
            <div class="e-invest-grand-val">${cFmt(hasExtras?grandIn:P.totalIn,0)}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <div class="c-sec">
    <div class="c-sec-hd">What's Included</div>
    <ul>${includedLines.map(l=>`<li>${l}</li>`).join('')}</ul>
  </div>
  <div class="c-sec">
    <div class="c-sec-hd">Also of Interest</div>
    ${alsoLines.map(l=>`<p>${l}</p>`).join('')}
  </div>
  ${notePara||validLine||depositLine?`<div class="c-sec">${notePara}${validLine}${depositLine}</div>`:''}
  <div class="c-sec" style="border-top:1px solid var(--border);padding-top:16px;">
    <p>For any further questions, please don't hesitate to reach out.</p>
    <p>Warmly,<br><strong>${signoff}</strong></p>
    <p style="font-size:10px;color:var(--muted);margin-top:12px;">namaste@ubuntubali.com &nbsp;·&nbsp; +62 812 3862 0082 &nbsp;·&nbsp; www.ubuntubali.com</p>
  </div>
</div>`;
}

function buildContractHTML(){
  const name=$('f-name').value||'___________', company=$('f-company').value||'___________';
  const address=$('f-address').value||'___________', phone=$('f-phone').value||'___________';
  const website=$('f-website').value||'___________', contactTitle=$('f-title').value||'___________';
  const retreatName=$('f-retreatname').value||'___________';
  const guests=parseInt($('f-guests').value)||10, facilitators=parseInt($('f-facilitators').value)||0;
  const totalPeople=guests+facilitators, checkin=$('f-checkin').value, checkout=$('f-checkout').value;
  const contractDate=$('f-contractdate').value||todayStr(), validUntil=$('f-validuntil').value||addDays(contractDate,7);
  const depositPct=Math.min(100,Math.max(0,parseFloat($('f-deposit').value)||0));
  const idrRate=parseFloat($('f-idrrate').value)||17085, bookingType=$('f-bookingtype').value;
  const P=pricing(), nights=P.nights, days=nights+1;
  const extTotal=extraServicesTotal(), hasExtrasC=extraServices.length>0;
  const grandExC=P.totalEx+extTotal, grandInC=P.totalIn+extTotal*TAX;
  const finalTotal=hasExtrasC?grandInC:P.totalIn;
  const idrTotal=finalTotal*idrRate;
  const PMT=payments(finalTotal,checkin,depositPct);
  const BANK={Currency:'IDR','Account Holder':'PT PURUSA YOGA BALI',Bank:'PT Bank Permata, Tbk','Account Number':'4122048077','BIC / SWIFT':'BBBAIDJAXXX','Bank Address':'Jalan Subak Sari No. 1, Badung, Bali'};
  const CANCEL=[['12+ months prior','100%'],['9–12 months prior','80%'],['6–9 months prior','60%'],['3–6 months prior','40%'],['1–3 months prior','20%'],['Less than 1 month prior','No refund (0%)']];
  const cR=(label,sub,amt)=>`<tr><td>${label}${sub?`<span style="display:block;font-size:9px;color:#9E948A;margin-top:2px;">${sub}</span>`:''}</td><td style="text-align:right;white-space:nowrap;">${amt}</td></tr>`;
  const bR=P.bales<=0?'':P.bales<=5
    ?cR(`${P.bales} Gladak${P.bales>1?'s':''}`,`${cFmt(P.roomRate,0)}/night · ${nights} nights`,cFmt(P.bales*P.roomRate,2))
    :cR('5 Gladaks',`${cFmt(P.roomRate,0)}/night · ${nights} nights`,cFmt(5*P.roomRate,2))
     +cR(`${P.bales-5} Partner Hotel Room${P.bales-5>1?'s':''}`,`${cFmt(P.roomRate,0)}/night · ${nights} nights`,cFmt((P.bales-5)*P.roomRate,2));
  const pR=P.parvOn?cR('Parvati Villa',`${cFmt(P.parvDisc,0)}/night · ${nights} nights`,cFmt(P.parvDisc,2)):'';
  const buR=P.buddOn?cR('Buddha Villa',`${cFmt(P.buddDisc,0)}/night · ${nights} nights`,cFmt(P.buddDisc,2)):'';
  const pkR=P.pkgCount>0?cR(`Per person package — ${P.pkgCount} guests`,`${cFmt(P.pkgRate,2)}/night · ${nights} nights (meals, shala, staff)`,cFmt(P.pkgSub,2)):'';
  const extR=hasExtrasC?`<tr><td colspan="2" style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#8B7355;padding:8px 10px 3px;border-top:1px solid #DDD0BA;">Extra Services</td></tr>${extraServices.map(s=>{if(s.pricingEngine){const t=getIdrRate()>0?(s.spppIdr*s.pax)/getIdrRate():0;return cR(`${s.label} (${s.pax} pax)`,`${getIdrRate()>0?cFmt(s.spppIdr/getIdrRate(),0):'—'}/person`,cFmt(t,0));}const t=s.unitUsd*s.qty;const qtyStr=s.unit==='flat fee'?'':` × ${s.qty}`;return cR(`${s.label}${qtyStr}`,'',cFmt(t,0));}).join('')}`:'';
  const txR=cR('Tax (10%) + Service charge (5%)','',cFmt(finalTotal-(hasExtrasC?grandExC:P.totalEx),2));
  const ebR=P.discPct>0?cR(`<strong>${P.discPct}% Early Bird Discount</strong>`,'',`<strong>– ${cFmt(P.earlyAmt*nights,2)}</strong>`):'';
  const rdR=P.discRooms>0&&P.discRoomPct>0?cR(`<strong>${P.discRooms} Room${P.discRooms>1?'s':''} — ${P.discRoomPct}% Special Rate</strong>`,'',`<strong>– ${cFmt(P.roomDiscAmt*nights,2)}</strong>`):'';
  const totR=`<tr style="background:#F5ECD7;font-weight:700;"><td>Total incl. tax &amp; service charge</td><td style="text-align:right;white-space:nowrap;">${cFmt(finalTotal,2)}</td></tr>`;
  const idrR=`<tr style="background:#2E1A0A;color:#F5ECD7;"><td style="font-size:9.5px;font-weight:700;">IDR equivalent<span style="display:block;font-size:8px;font-weight:400;opacity:.75;margin-top:2px;">1 USD = ${Number(idrRate).toLocaleString('id-ID')} · interbank rate on date of issue</span></td><td style="text-align:right;white-space:nowrap;font-size:11px;font-weight:700;">Rp ${Number(idrTotal).toLocaleString('id-ID',{minimumFractionDigits:0})}</td></tr>`;
  return`<div class="contract-doc">
  <div class="c-hd">
    <img src="https://images.squarespace-cdn.com/content/v1/601cf6a4fabc2a27672c7e92/1612600900318-S8C53NTKP4MK405H0BTU/Ubuntu+logo+9-12-20-09.png?format=400w" style="height:44px;display:block;margin:0 auto 14px;filter:brightness(0) sepia(1) saturate(3) hue-rotate(5deg) brightness(.35);">
    <div class="c-hd-title">Retreat Booking Confirmation & Agreement</div>
    <div class="c-hd-sub">PT Purusa Yoga Bali · Operating as Ubuntu Bali</div>
  </div>
  <div style="font-family:'Libre Baskerville',serif;font-size:9.5px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:center;margin-bottom:12px;color:#5C3D2E;">BETWEEN</div>
  <div class="c-parties">
    <div class="c-party"><div class="c-party-title">Retreat Organizer</div>
      <p>Company Name: ${company}</p><p>Contact Person: ${name}</p><p>Address: ${address}</p><p>Phone: ${phone}</p><p>Website: ${website}</p></div>
    <div class="c-party"><div class="c-party-title">Venue Holder</div>
      <p>Company: PT Purusa Yoga Bali (Ubuntu Bali)</p><p>Director: Witri Utari</p><p>Contract: Andréa Drottholm</p><p>Phone: +62 812 3862 0082</p><p>Email: namaste@ubuntubali.com</p></div>
  </div>
  <div class="c-datebar">Date: ${fmtDS(contractDate)} &nbsp;|&nbsp; Check-in: ${fmtDS(checkin)} &nbsp;|&nbsp; Check-out: ${fmtDS(checkout)}</div>
  <div class="c-validity"><strong style="font-family:'Libre Baskerville',serif;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;">Contract Validity: </strong>This contract offer is valid until <strong>${fmtDS(validUntil)}</strong>. If not confirmed by the Retreat Organizer by this date, the offer lapses and Ubuntu Bali reserves the right to release the reserved dates.</div>
  <div class="c-sec"><div class="c-sec-hd">A) Purpose of Agreement</div>
    <p>This Agreement is entered into between Ubuntu Bali and the Retreat Organizer for the purpose of hosting a retreat at Ubuntu Bali for the agreed dates.</p>
    <p>This Agreement is intended to clearly define responsibilities, financial commitments, and expectations to ensure a smooth, respectful, and professional collaboration.</p></div>
  <div class="c-sec"><div class="c-sec-hd">B) Pricing & Inclusions</div>
    <p>All prices in this Agreement are stated in ${window.offerCurrency||'USD'}. Payment must be made in IDR, converted at the interbank exchange rate on the date Ubuntu Bali receives payment.</p>
    <p><strong>Retreat Package: ${retreatName} · ${nights} Nights, ${days} Days · ${totalPeople} Guests</strong></p>
    <p>Check-in: ${fmtDS(checkin)} · Check-out: ${fmtDS(checkout)}</p>
    <table class="c-table"><thead><tr><th>ITEM</th><th style="text-align:right;">TOTAL</th></tr></thead>
    <tbody>${bR}${pR}${buR}${pkR}${extR}${txR}${ebR}${rdR}${totR}${idrR}</tbody></table>
    <p style="font-size:10.5px;color:#7A6040;font-style:italic;">The IDR figure above is provided as a reference conversion at the interbank exchange rate on the date of issue. All payments must be made in IDR at the interbank rate on the actual date of each transaction.</p>
    <p><strong>What's Included:</strong></p>
    <ul><li>2 plant based meals per day</li><li>Tea and afternoon snack</li><li>Shala of your choice and cleaning</li><li>Full staff support and dedicated contact person</li></ul>
    <p>The package price is fixed for ${totalPeople} guests. Should the group exceed ${totalPeople} people, the room rate remains the same — only meals would be added for each additional guest.</p></div>
  <div class="c-sec"><div class="c-sec-hd">C) Payments & Bank Details</div>
    <p>Payments must be made to the following account:</p>
    <table class="bank-table">${Object.entries(BANK).map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table>
    <p>All bank and transfer fees are the responsibility of the Retreat Organizer.</p></div>
  <div class="c-sec"><div class="c-sec-hd">D) Payment Schedule</div>
    <p><strong>This booking qualifies as a ${bookingType} BOOKING ${bookingType==='STANDARD'?'(more than 120 days before retreat start)':'(less than 120 days before retreat start)'}.</strong></p>
    <table class="c-table"><thead><tr><th>Payment</th><th>Percentage</th><th>Amount (${window.offerCurrency||'USD'})</th><th>Due Date</th></tr></thead>
    <tbody><tr><td>Deposit</td><td>${PMT.dep.pct}</td><td>${cFmt(PMT.dep.amt,2)}</td><td>${PMT.dep.due}</td></tr>
    <tr><td>2nd Payment</td><td>${PMT.p2.pct}</td><td>${cFmt(PMT.p2.amt,2)}</td><td>${PMT.p2.due}</td></tr>
    <tr><td>Final Payment</td><td>${PMT.p3.pct}</td><td>${cFmt(PMT.p3.amt,2)}</td><td>${PMT.p3.due}</td></tr></tbody></table>
    <p>Failure to meet payment deadlines may result in cancellation of the booking without refund.</p></div>
  <div class="c-sec"><div class="c-sec-hd">E) Cancellation & Refund Policy</div>
    <p><strong>Standard Bookings:</strong> Cancellation refunds are calculated as percentages of the non-refundable deposit only, minus bank transfer fees.</p>
    <table class="c-table"><thead><tr><th>Cancellation Period</th><th>Refund of Deposit (minus bank fees)</th></tr></thead>
    <tbody>${CANCEL.map(([p,r])=>`<tr><td>${p}</td><td>${r}</td></tr>`).join('')}</tbody></table>
    <p><strong>Short-Notice Bookings:</strong> Deposits are non-refundable except in cases of force majeure.</p>
    <p><strong>Rescheduling:</strong></p>
    <ul><li>One reschedule permitted within 12 months, subject to availability and a 10% administrative fee</li><li>Requests must be made at least 3 months prior to retreat start</li></ul></div>
  <div class="c-sec"><div class="c-sec-hd">F) Liability, Insurance & Indemnification</div>
    <ul><li>All participants must carry adequate travel and health insurance covering yoga, wellness activities, and medical evacuation</li><li>Retreat Organizer must communicate health restrictions to Ubuntu Bali in writing at least 30 days prior</li><li>Ubuntu Bali shall not be held liable for personal injury, loss, or theft except in cases of gross negligence</li><li>Ubuntu Bali's maximum liability is limited to 50% of the total contract value</li></ul></div>
  <div class="c-sec"><div class="c-sec-hd">G) Property Use & Conduct</div>
    <ul><li>Quiet hours: 9:30pm – 7:00am</li><li>No smoking, alcohol, drugs, or intoxicants on the premises</li><li>Yoga Shala must be left tidied, fans and lights switched off</li><li>Participant-caused property damage will be charged to the Retreat Organizer</li></ul></div>
  <div class="c-sec"><div class="c-sec-hd">H) Meals</div>
    <p>Two plant based meals per day are included for registered overnight guests only. Additional meals must be arranged in advance.</p></div>
  <div class="c-sec"><div class="c-sec-hd">I) Swimming Pool</div>
    <p>Available to all registered retreat participants. All users must shower before entering.</p></div>
  <div class="c-sec"><div class="c-sec-hd">J) Wi-Fi</div>
    <p>Provided across the property in common areas, subject to local service availability.</p></div>
  <div class="c-sec"><div class="c-sec-hd">K) Photography & Media</div>
    <p>Ubuntu Bali may photograph or film during the retreat for promotional use, subject to retreat leader permission. Participants will not be identified by name without written consent.</p></div>
  <div class="c-sec"><div class="c-sec-hd">L) Force Majeure</div>
    <p>In the event of circumstances beyond reasonable control, Ubuntu Bali shall provide immediate notice and offer: (a) reschedule within 18 months, (b) 100% credit valid 24 months, or (c) pro-rata refund minus 5% admin fee.</p></div>
  <div class="c-sec"><div class="c-sec-hd">M) Dispute Resolution</div>
    <ul><li>Informal Resolution (7 days): Written notice</li><li>Management Discussion (14 days): In-person or video meeting</li><li>Mediation (30 days, optional): Neutral third party</li><li>Legal Action: Only after above steps attempted</li></ul></div>
  <div class="c-sec"><div class="c-sec-hd">N) Ubuntu Bali Cancellation</div>
    <p>Ubuntu Bali may cancel with 60 days written notice. Retreat Organizer receives 100% refund and priority rebooking within 18 months. Short-notice cancellation (&lt;60 days): full refund plus 5% credit.</p></div>
  <div class="c-sec"><div class="c-sec-hd">O) Termination</div>
    <p>Either party may terminate for material breach with 14 days written notice.</p></div>
  <div class="c-sec"><div class="c-sec-hd">P) Governing Law</div>
    <p>Governed by the laws of Indonesia. Jurisdiction lies exclusively with the courts of Bali.</p></div>
  <div class="c-sec"><div class="c-sec-hd">Q) Entire Agreement</div>
    <p>This Agreement constitutes the entire understanding between the parties. Any amendments must be made in writing and signed by both parties.</p></div>
  <div class="c-sigs"><div class="c-sigs-title">Signatures</div>
    <div class="c-sigs-grid">
      <div><div class="c-sig-party">For Ubuntu Bali</div>
        <p style="font-size:12px;margin-bottom:3px;">Name: Andréa Drottholm</p>
        <p style="font-size:12px;margin-bottom:3px;">Title: Contract Representative</p>
        <p style="font-size:12px;margin-bottom:16px;">Date: ${fmtDS(contractDate)}</p>
        <p style="font-size:12px;margin-bottom:4px;">Signature:</p>
        <div class="c-sig-line"></div>
        <div class="c-sig-note">${$('f-signoff2')?.value.trim()||'Tari, as representative of Andréa Drottholm'}</div></div>
      <div><div class="c-sig-party">For Retreat Organizer</div>
        <p style="font-size:12px;margin-bottom:3px;">Name: ${name}</p>
        <p style="font-size:12px;margin-bottom:3px;">Title: ${contactTitle}</p>
        <p style="font-size:12px;margin-bottom:16px;">Date: ___________</p>
        <p style="font-size:12px;margin-bottom:4px;">Signature:</p>
        <div class="c-sig-line"></div>
        <div class="c-sig-note">${name}</div></div>
    </div>
  </div>
</div>`;
}

function renderOffer(){$('offer-output').innerHTML=buildOfferHTML();}
function renderContract(){$('contract-output').innerHTML=buildContractHTML();}
function render(){}

// ── EXTRA SERVICES ────────────────────────────────────────────────────────────
let extraServices = [];
Object.defineProperty(window, 'extraServices', { get() { return extraServices }, set(v) { extraServices = v } });

function getIdrRate() {
  return parseFloat(document.getElementById('f-idrrate')?.value) || 17085;
}

function getTotalPax() {
  return (parseInt($('f-guests')?.value) || 0) + (parseInt($('f-facilitators')?.value) || 0) || 1;
}

function syncPeExtrasPax() {
  const pax = getTotalPax();
  extraServices.forEach(s => {
    if (s.pricingEngine && window.recalculatePeExtra) window.recalculatePeExtra(s.id, pax);
  });
}

function addExtraService(val) {
  if (!val) return;
  const parts = val.split('|');
  const id = parts[0], label = parts[1];
  if (id.startsWith('pe_')) {
    const templateId = id.slice(3);
    const pax = getTotalPax();
    const item = { id: Date.now(), serviceId: id, label, unit: 'per person',
      pricingEngine: true, templateId, pax, spppIdr: 0, qty: 1, unitUsd: 0 };
    extraServices.push(item);
    renderExtraServices();
    if (window.recalculatePeExtra) window.recalculatePeExtra(item.id, pax);
    markDraftActive();
    return;
  }
  let unitUsd = parseFloat(parts[2]) || 0;
  const unit = parts[3] || 'per unit';
  let finalLabel = label;
  if (id === 'custom') {
    finalLabel = prompt('Service name:') || 'Custom Service';
    unitUsd = parseFloat(prompt('Price in USD:') || '0');
  }
  const item = { id: Date.now(), serviceId: id, label: finalLabel, unitUsd, unit, qty: 1 };
  extraServices.push(item);
  renderExtraServices();
  markDraftActive();
}

function removeExtraService(id) {
  extraServices = extraServices.filter(s => s.id !== id);
  renderExtraServices();
  markDraftActive();
}

function updateExtraQty(id, qty) {
  const s = extraServices.find(s => s.id === id);
  if (s) { s.qty = Math.max(1, parseInt(qty) || 1); renderExtraServices(); markDraftActive(); }
}

function updateExtraPrice(id, usd) {
  const s = extraServices.find(s => s.id === id);
  if (s) { s.unitUsd = parseFloat(usd) || 0; renderExtraServices(); markDraftActive(); }
}

function renderExtraServices() {
  const list = document.getElementById('extras-list');
  const totalEl = document.getElementById('extras-total');
  if (!list) return;
  if (!extraServices.length) {
    list.innerHTML = '';
    if (totalEl) totalEl.style.display = 'none';
    return;
  }
  list.innerHTML = extraServices.map(s => {
    if (s.pricingEngine) {
      const totalUsd = getIdrRate() > 0 ? (s.spppIdr * s.pax) / getIdrRate() : 0;
      const priceLabel = s.spppIdr && getIdrRate() > 0 ? `${cFmt(s.spppIdr / getIdrRate(), 0)}/pax` : '—';
      return `<div class="extra-tag"><div class="extra-tag-label">${s.label}</div><div class="extra-tag-qty"><span style="font-size:11px;color:var(--muted);">Pax</span><input type="number" value="${s.pax}" min="1" style="width:54px;" onchange="window.recalculatePeExtra && window.recalculatePeExtra(${s.id}, parseInt(this.value)||1)" onclick="this.select()"><span style="font-size:11px;color:var(--muted);min-width:100px;">${priceLabel}</span></div><div class="extra-tag-price">${totalUsd ? cFmt(totalUsd, 0) : '—'}</div><button class="extra-tag-del" onclick="removeExtraService(${s.id})">✕</button></div>`;
    }
    return `<div class="extra-tag"><div class="extra-tag-label">${s.label}</div><div class="extra-tag-qty"><span style="font-size:11px;color:var(--muted);">${s.unit === 'flat fee' ? '' : 'Qty'}</span>${s.unit === 'flat fee' ? '' : `<input type="number" value="${s.qty}" min="1" onchange="updateExtraQty(${s.id}, this.value)" onclick="this.select()">`}<input type="number" value="${fmtN(s.unitUsd,0)}" min="0" style="width:70px;" onchange="updateExtraPrice(${s.id}, this.value)" onclick="this.select()" title="USD per unit"></div><div class="extra-tag-price">${cFmt(s.unitUsd * s.qty, 0)}</div><button class="extra-tag-del" onclick="removeExtraService(${s.id})">✕</button></div>`;
  }).join('');
  if (totalEl) {
    totalEl.style.display = 'block';
    totalEl.textContent = `Extra Services Total: ${cFmt(extraServicesTotal(), 0)}`;
  }
}

function extraServicesTotal() {
  return extraServices.reduce((sum, s) => {
    if (s.pricingEngine) return sum + (getIdrRate() > 0 ? (s.spppIdr * s.pax) / getIdrRate() : 0);
    return sum + s.unitUsd * s.qty;
  }, 0);
}

function extraServicesHTML() {
  if (!extraServices.length) return '';
  const rows = extraServices.map(s => {
    const total = s.unitUsd * s.qty;
    const qtyStr = s.unit === 'flat fee' ? '' : ` × ${s.qty}`;
    return `<tr class="pt-item"><td class="col-item">${s.label}</td><td class="col-rate" style="color:#555;">${cFmt(s.unitUsd,0)}${qtyStr}</td><td class="col-sub">${cFmt(total,0)}</td></tr>`;
  }).join('');
  return `<tr class="pt-colhead"><td colspan="3" style="padding-top:8px;font-size:8px;letter-spacing:1px;text-transform:uppercase;color:#999;">Extra Services</td></tr>${rows}`;
}

function getExtraServicesState() {
  return JSON.stringify(extraServices);
}

function setExtraServicesState(json) {
  try { extraServices = JSON.parse(json) || []; } catch { extraServices = []; }
  renderExtraServices();
}

(() => {
  'use strict';
  if(globalThis.__liveV1)return;
  globalThis.__liveV1=true;
  const U=LiveUIV1,M=LiveModel;
  const {all,text,norm,clean,wait,exact,unique,click,button,field,set,setDate,choose,settled}=U;
  let busy=false;
  const cards=()=>all('.google-meet__item');
  const fc=(root,name,type='input')=>unique(all(`[formcontrolname="${name}"] ${type},${type}[formcontrolname="${name}"]`,root),name);
  function cardFor(t) {
    const list=cards();
    const link=c=>all('input',c).map(e=>e.value).find(M.validLink);
    if(t.connectionLink){const found=list.filter(c=>link(c)===t.connectionLink);if(found.length)return unique(found,'Meet қосылымы');}
    const match=list.filter(c=>{try{return readDate(fc(c,'date').value)===t.date&&fc(c,'startTime').value===t.start&&fc(c,'endTime').value===t.end;}catch{return false;}});
    if(match.length)return unique(match,'Күн/уақыты сәйкес қосылым');
    if(list.length===1)return list[0];
    throw Error('Қосылым бірмәнді анықталмады. Бұл сабақтағы қосылымды қолмен таңдаңыз.');
  }
  function readDate(value){return /^\d{2}\.\d{2}\.\d{4}$/.test(value)?value.split('.').reverse().join('-'):value;}
  const linkOf=c=>[...new Set(all('input,a',c).map(e=>e.value||e.getAttribute('href')).filter(M.validLink))];
  // U.norm lower-cases text, so every label is compared in lower case. The label may change with the state
  // («Жарияланды» / «Жарияланбаған»), therefore both forms identify the same publication switch.
  const switchLabel=e=>clean(e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||e.labels?.[0]?.textContent||'');
  const publicationLabel=/^(жарияланды|жарияланбады|жарияланбаған|жариялау|опубликовано|не опубликовано|опубликовать)$/;
  const publicationSwitches=()=>all('[role="switch"]').filter(e=>publicationLabel.test(norm(switchLabel(e))));
  const isOn=e=>e.getAttribute('aria-checked')==='true'||e.checked===true;
  const published=()=>{const switches=publicationSwitches();return {controls:switches,value:switches.length>0&&switches.every(isOn)};};
  function courseInfo(){return U.inspect();}
  async function ready(t){await U.checkCourse(t);await wait(()=>cards().length,'Google Meet қосылымдары');await settled('Сабақ жүктелуде');return cardFor(t);}
  async function groupState(control) {
    if(control.tagName==='SELECT'){const opts=[...control.options].filter(o=>o.value&&!o.disabled);return {all:opts.length>0&&opts.every(o=>o.selected),names:opts.filter(o=>o.selected).map(text)};}
    U.openSelect(control);await wait(()=>all('mat-option,[role="option"]',U.selectPanel(control)).length,'Топтар жүктелуде');
    const panel=U.selectPanel(control);await settled('Топтар жүктелуде');
    try{const opts=all('mat-option,[role="option"]',panel).filter(o=>o.getAttribute('aria-disabled')!=='true'&&!/^(барлығын таңдау|бәрін таңдау|выбрать все)$/i.test(text(o)));return {all:opts.length>0&&opts.every(U.optionSelected),names:opts.filter(U.optionSelected).map(text)};}
    finally{await U.closeGroups(control,panel);}
  }
  const mainName=()=>unique(all('#PRACTICAL_LESSON_NAME'),'Сабақ атауы');
  const editor=()=>unique(all('[contenteditable="true"]'),'Нұсқаулық');
  const linkedCard=c=>!!c.querySelector('[formcontrolname="reusableMeetingId"]')||/Басқа сабақпен байланысты/i.test(text(c));
  // In a connection linked to another lesson the meeting's own fields (title, time, scores, organizer) belong to the
  // source lesson and may be hidden. Those are reported as inherited instead of failing the whole read.
  const inheritedKeys=['studentTitle','date','start','end','attendance','percent','email'];
  function readFields(t,c) {
    const linked=linkedCard(c),inherit=(key,fn)=>{try{return fn();}catch(e){if(linked&&inheritedKeys.includes(key))return null;throw e;}};
    const controls={title:mainName(),studentTitle:inherit('studentTitle',()=>fc(c,'name')),date:inherit('date',()=>fc(c,'date')),start:inherit('start',()=>fc(c,'startTime')),end:inherit('end',()=>fc(c,'endTime')),deadline:fc(c,'deadlineDate'),deadlineTime:fc(c,'deadlineTime'),attendance:inherit('attendance',()=>fc(c,'meetingMaxScore')),percent:inherit('percent',()=>fc(c,'minAttendancePercent')),email:inherit('email',()=>U.organizerControl(c)),groups:field('Топ',{root:c,kind:'select',readOnly:true}),points:fc(document,'maxScore'),tag:field('Тапсырма тегін таңдау',{kind:'select',readOnly:true}),instruction:editor()};
    const data={editable:{},inherited:{},rating:U.switchEnabled('Рейтингке қосу')};
    for(const [key,e] of Object.entries(controls)){if(!e){data.inherited[key]=true;data.editable[key]=false;continue;}data.editable[key]=U.writable(e);data[key]=e.value??text(e);}
    data.editable.instruction=controls.instruction.isContentEditable||controls.instruction.getAttribute('contenteditable')==='true';
    if(controls.date)data.date=readDate(data.date);data.deadline=readDate(data.deadline);if(controls.email)data.email=U.organizerValue(controls.email);data.tag=U.selectedText(controls.tag);data.instruction=U.editorText(controls.instruction);
    data.instructionBold=allBold(controls.instruction);
    const links=linkOf(c);if(links.length>1)throw Error('Қосылымда бірнеше Meet сілтемесі бар.');data.link=links[0]||'';
    data.linked=linked;
    return {data,controls};
  }
  async function snapshot(t){const c=await ready(t);const {data,controls}=readFields(t,c);const groups=await groupState(controls.groups);data.groups=groups.all;data.groupNames=groups.names;data.published=published().value;data.lessonUrl=location.href;data.connectionCount=cards().length;return data;}
  function lessonCandidates(t){const headings=all('h1,h2,h3').filter(e=>/LIVE\s*САБАҚ\s*№/i.test(text(e)));const exactTitle=headings.filter(e=>norm(text(e))===norm(t.existingTitle||t.title));if(exactTitle.length)return exactTitle;const teacher=norm(t.teacher).split(' ').sort().join(' ');return headings.filter(e=>{const parts=text(e).split('|');return parts.length===3&&norm(parts[1]).split(' ').sort().join(' ')===teacher&&norm(parts[2])===norm(`${t.cohort}-АҒЫМ`)&&new RegExp('№\\s*'+t.number+'(?:\\s|$)').test(parts[0]);});}
  // Short texts on the page that look like themes or lessons. Shown to the person when nothing matched,
  // so a naming difference on the site is visible instead of silently turning into «Жаңа сабақ».
  // On the site, themes are h1.list__item-name in the sidebar (app-themes-list) and lessons are h1.title in the content.
  function seenTexts(kind){const inSidebar=e=>!!e.closest('app-themes-list,.list__item');const heads=all('h1,h2,h3').filter(e=>kind==='theme'?inSidebar(e):!inSidebar(e)).map(text);return [...new Set(heads.filter(s=>kind==='theme'?/live/i.test(s):/live\s*сабақ\s*№/i.test(s)))].slice(0,12);}
  async function open(t) {
    U.stage(t,'Курс, ай және апта тексерілуде');const c=await U.checkCourse(t);
    if(c.role!=='methodist'&&!location.pathname.includes('/methodologist-mode/')){await button('Әдіскер режимі');await wait(()=>location.pathname.includes('/methodologist-mode/'),'Әдіскер режимі');}
    const month=await wait(()=>all('mat-select,[role="combobox"]').find(e=>/^\d+\s*ай$/i.test(U.selectedText(e))),'Ай мәзірі');
    await choose(month,t.month+' Ай');await settled('Ай жүктелуде');
    await button(t.week+' АПТА');await settled('Апта жүктелуде');
    let theme=exact(t.theme,'h1,h2,h3');if(theme.length>1)throw Error('Бірдей LIVE тақырыбы бірнешеу. Қажетті тақырыпты қолмен тексеріңіз.');
    // 22.10.2026: a wrong month in the plan created «3-АЙ 3-АПТА | LIVE САБАҚ» in a week that had no other themes yet.
    // A week without a single theme is treated as a wrong month/week: nothing is created there.
    if(!theme.length&&!await U.waitQuietly(()=>all('.list__item-name').length>0,3000)){if(!t.allowCreate)return {exists:false,missing:'week',seen:[]};throw safeError(`«${t.month}-АЙ ${t.week}-АПТА» аптасында сайтта бірде-бір тақырып жоқ. Ай мен апта дұрыс па? Тақырып пен сабақ құрылмады.`);}
    if(!theme.length){if(!t.allowCreate)return {exists:false,missing:'theme',seen:seenTexts('theme')};await createTheme(t);theme=exact(t.theme,'h1,h2,h3');}
    click(unique(theme,'LIVE тақырыбы'));await settled('LIVE тізімі жүктелуде');await wait(()=>exact('Сабақ құру','button').length,'Сабақтар тізімі');
    let candidate=lessonCandidates(t);if(candidate.length>1)throw Error('Бірнеше сәйкес сабақ бар. Қайталануды қолмен тексеріңіз.');
    if(!candidate.length){if(!t.allowCreate)return {exists:false,missing:'lesson',seen:seenTexts('lesson')};await createLesson(t);}
    else click(candidate[0]);
    await ready(t);return {exists:true,created:!candidate.length,lessonUrl:location.href};
  }
  async function createTheme(t){await buttonIn('.list__new_theme','Тақырып қосу');const d=await wait(()=>all('[role="dialog"],mat-dialog-container').find(e=>text(e).includes('Тақырып құру')),'Тақырып формасы');set(field('Атауы',{root:d}),t.theme);const groups=all('[role="radiogroup"]',d);if(groups.length!==2)throw Error('Тақырып форматы өзгерді.');for(const [index,value] of [[0,t.month],[1,t.week]]){click(unique(all('input[type="radio"]',groups[index]).filter(e=>norm(e.closest('mat-radio-button')?.textContent)===String(value)),'Ай/апта'));}setDate(unique(all('input[type="date"]',d),'Күн'),t.date);setTime(unique(all('input[role="combobox"],input[type="time"]',d),'Уақыт'),'00:00');await button('Сақтау',d);await wait(()=>exact(t.theme,'h1,h2,h3').length,'Жаңа тақырып');}
  async function buttonIn(selector,label){click(unique(all(selector+' button'),label));}
  async function createLesson(t){await button('Сабақ құру');const d=await wait(()=>all('[role="dialog"],mat-dialog-container').find(e=>text(e).includes('Сабақ қосу')),'Сабақ формасы');const selects=all('mat-select,select',d).filter(U.writable);if(selects.length===1)await choose(selects[0],'Live сабақ');else{click(unique(exact('Сабақтың типін таңдаңыз','span',d),'Сабақ түрі'));click(await wait(()=>exact('Live сабақ','span').find(U.visible),'Live сабақ'));}set(field('Атауы',{root:d}),t.title);await button('Сақтау',d);await wait(()=>!all('[role="dialog"],mat-dialog-container').length,'Сабақ құру');const next=await wait(()=>all('#PRACTICAL_LESSON_NAME').length?{form:true}:lessonCandidates(t)[0]?{heading:lessonCandidates(t)[0]}:null,'Сабақ ашылуда');if(next.heading)click(next.heading);}
  function setTime(e,value){set(e,'');set(e,value);const option=all('[role="option"],mat-option').find(e=>text(e)===value);if(option)click(option);e.blur();}
  // The site's CKEditor drops <strong> from pasted HTML (seen 22.10.2026), so bold is applied afterwards the same way a
  // person does it: select everything and press the toolbar «Bold» button.
  const allBold=e=>{const ps=[...e.querySelectorAll('p,li')].filter(p=>clean(p.textContent));return ps.length>0&&ps.every(p=>clean([...p.querySelectorAll('strong,b')].map(s=>s.textContent).join(''))===clean(p.textContent));};
  function selectEditor(e){e.focus();const range=document.createRange();range.selectNodeContents(e);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));}
  async function makeBold(e){if(allBold(e))return true;const scope=e.closest('.ck-editor')||document;const bold=all('.ck-toolbar button',scope).find(b=>/^(bold|жуан|полужирный)$/i.test(text(b.querySelector('.ck-button__label')))||/^(bold|жуан|полужирный)\b/i.test(b.getAttribute('data-cke-tooltip-text')||''));if(!bold)return false;
    // A partly bold text makes the first press remove bold, so a second press is allowed.
    for(let i=0;i<2&&!allBold(e);i++){selectEditor(e);await new Promise(r=>setTimeout(r,200));click(bold);await U.waitQuietly(()=>allBold(e),1500);}return allBold(e);}
  async function writeInstruction(value){const e=editor();if(U.editorText(e)===clean(value)){await makeBold(e);return;}e.focus();const range=document.createRange();range.selectNodeContents(e);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.dispatchEvent(new Event('selectionchange'));const escape=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));const html=value.split('\n').filter(Boolean).map(p=>'<p><strong>'+escape(p)+'</strong></p>').join('');if(e.classList.contains('ck-editor__editable')){const data=new DataTransfer();data.setData('text/html',html);e.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:data}));}else{document.execCommand('insertHTML',false,html);e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste'}));}await wait(()=>U.editorText(e)===clean(value),'Нұсқаулық редакторға енгізілуде');await makeBold(e);}
  async function fillFields(t, keys) {
    const c=await ready(t),{controls}=readFields(t,c);
    for(const key of keys){const value=t[key];if(key==='groups'){await U.allGroups(controls.groups);continue;}if(key==='email'){await U.chooseOrganizer(controls.email,value);continue;}if(key==='tag'){await choose(controls.tag,'Live сабақ');continue;}if(key==='rating'){await U.toggle('Рейтингке қосу');continue;}if(key==='instruction'){await writeInstruction(value);continue;}if(!controls[key])throw Error('Өріс танылмады: '+key);if(['date','deadline'].includes(key))setDate(controls[key],value);else if(['start','end','deadlineTime'].includes(key))setTime(controls[key],value);else set(controls[key],value);}
    return {lessonUrl:location.href};
  }
  const meetingKeys=['title','studentTitle','date','start','end','deadline','deadlineTime','attendance','percent','groups','email'];
  const notesKeys=['rating','tag','points','instruction'];
  // On 21.10.2026 a click on «Құру» silently did nothing because the time field had not been accepted by the form.
  // The site marks such controls with .ng-invalid, so «Құру» is pressed only when every Meet field is valid.
  const meetingControlLabels={name:'Студентке көрінетін атауы',date:'Күн',startTime:'Басталуы',endTime:'Аяқталуы',deadlineDate:'Дедлайн күні',deadlineTime:'Дедлайн уақыты',meetingMaxScore:'Қатысым баллы',minAttendancePercent:'Қатысым пайызы',groupIds:'Топтар',organizerEmail:'Email'};
  const invalidMeetingFields=c=>[...new Set([...c.querySelectorAll('[formcontrolname].ng-invalid,[formcontrolname] .ng-invalid')].map(e=>(e.matches('[formcontrolname]')?e:e.closest('[formcontrolname]')).getAttribute('formcontrolname')).filter(n=>meetingControlLabels[n]))];
  // A «safe» error happened before anything was sent to the site, so the step is not left as «Нәтиже белгісіз».
  const safeError=message=>Object.assign(Error(message),{safe:true});
  async function assertMeetingValid(c){const deadline=Date.now()+4000;let invalid=invalidMeetingFields(c);while(invalid.length&&Date.now()<deadline){await new Promise(r=>setTimeout(r,200));invalid=invalidMeetingFields(c);}if(invalid.length)throw safeError('Сайт мына өрісті қабылдамады, «Құру» басылмады: '+invalid.map(n=>meetingControlLabels[n]).join(', ')+'. Өрісті сайтта қолмен тексеріп, қайта тексеріңіз.');}
  // Everything before «Құру» only changes the unsaved form, so a failure there is marked safe.
  async function beforeCreate(fn){try{return await fn();}catch(e){throw Object.assign(e,{safe:true});}}
  const addButton=()=>all('button').filter(e=>/^\+?\s*Қосылым қосу$/i.test(text(e)));
  async function addConnection(kind){click(unique(addButton(),'+ Қосылым қосу'));click(await wait(()=>all('[role="menuitem"]').find(e=>text(e).startsWith(kind)),kind));}
  // A connection without a Meet link and without a chosen meeting holds nothing saved on the server.
  const blankCard=c=>!linkOf(c).length&&!c.querySelector('[formcontrolname="reusableMeetingId"]');
  async function removeCard(c){const del=unique(all('button[aria-label="Кездесуді жою"],button.google-meet__delete',c),'Кездесуді жою');click(del);await wait(()=>!c.isConnected||!U.visible(c)||dialogs().length,'Бос қосылымды өшіру',5000);if(c.isConnected&&U.visible(c))throw Error('Бос қосылымды өшіру растауды сұрады. Оны сайтта қолмен өшіріп, қайта тексеріңіз.');}
  async function createMeet(t){
    // A fresh LIVE lesson normally has one empty connection; if not, it is added with «+ Қосылым қосу» → «Жаңа кездесу құру».
    const c=await beforeCreate(async()=>{await U.checkCourse(t);await wait(()=>all('#PRACTICAL_LESSON_NAME').length,'Сабақ формасы');await settled('Сабақ жүктелуде');if(!cards().length&&addButton().length)await addConnection('Жаңа кездесу құру');return ready(t);});
    const links=linkOf(c);if(links.length)return {link:unique(links,'Meet'),lessonUrl:location.href};
    await beforeCreate(async()=>{await fillFields(t,meetingKeys);const before=readFields(t,c).data;const differences=M.diff(t,{...before,groups:true}).filter(d=>meetingKeys.includes(d.key));if(differences.length)throw Error('Meet өрісі қабылданбады, «Құру» басылмады: '+differences.map(d=>d.label).join(', '));await assertMeetingValid(c);await button('Құру',c);});
    await wait(()=>linkOf(cardFor(t)).length,'Meet сілтемесі құрылуда',60000);return {link:unique(linkOf(cardFor(t)),'Meet'),lessonUrl:location.href};}
  async function attach(t){
    const c=await beforeCreate(async()=>{
      if(!t.reuse?.published||!M.validLink(t.reuse.link))throw Error('Бастапқы жарияланған Meet расталмаған.');
      await U.checkCourse(t);await wait(()=>all('#PRACTICAL_LESSON_NAME').length,'Сабақ формасы');await settled('Сабақ жүктелуде');
      if(cards().some(c=>linkOf(c).includes(t.reuse.link)))return null;
      if(cards().some(c=>linkOf(c).length))throw Error('Сабақта басқа Meet бар. Сілтеме автоматты ауыстырылмайды.');
      // As on the site on 14.10.2026: add «Бар кездесуді таңдау», then delete the empty default connection.
      const blanks=cards().filter(blankCard);
      await addConnection('Бар кездесуді таңдау');
      const c=await wait(()=>cards().find(e=>e.querySelector('[formcontrolname="reusableMeetingId"]')),'Қосылым формасы');
      for(const b of blanks)await removeCard(b);
      const select=fc(c,'reusableMeetingId','mat-select');U.openSelect(select);
      const option=await wait(()=>{const list=all('mat-option,[role="option"]',U.selectPanel(select)).filter(e=>{const v=norm(text(e));return v.includes(norm(t.reuse.courseName))&&(v.includes(norm(t.title))||v.includes(norm(t.studentTitle)))&&v.includes(t.date.split('-').reverse().join('.'))&&v.includes(t.start)&&v.includes(t.end);});if(list.length>1)throw Error('Бірнеше бастапқы кездесу сәйкес келді.');return list[0];},'Бастапқы кездесу');
      await choose(select,text(option));
      // Since 21.10.2026 every connection has its own deadline; empty means «one day after the start», not 23:59.
      const deadlineDate=all('[formcontrolname="deadlineDate"] input',c)[0],deadlineTime=all('[formcontrolname="deadlineTime"] input',c)[0];
      if(deadlineDate)setDate(deadlineDate,t.deadline);if(deadlineTime)setTime(deadlineTime,t.deadlineTime);
      await U.allGroups(field('Топ',{root:c,kind:'select'}));
      const invalid=[...c.querySelectorAll('[formcontrolname].ng-invalid')].map(e=>e.getAttribute('formcontrolname'));
      if(invalid.length)throw Error('Сайт мына өрісті қабылдамады, «Құру» басылмады: '+invalid.map(n=>meetingControlLabels[n]||n).join(', '));
      await button('Құру',c);return c;});
    if(c)await wait(()=>cards().some(c=>linkOf(c).includes(t.reuse.link)),'Байланыстырылған Meet',60000);
    return {link:t.reuse.link,lessonUrl:location.href};}
  async function fillNotes(t){return fillFields(t,notesKeys);}
  async function patch(t){const current=await snapshot(t);const changed=(t.changes||[]);if(!changed.length)return current;for(const key of changed){if(!Object.hasOwn(M.fieldLabels,key)||key==='link')throw Error('Түзетуге болмайтын өріс: '+key);if(clean(current[key])!==clean(t.baseline[key]))throw Error('Сабақ тексеруден кейін өзгерген. Қайта тексеріңіз: '+M.fieldLabels[key]);}if(current.published)throw Error('Түзету үшін сабақтың жариялануын уақытша өшіру керек.');await fillFields(t,changed);if(changed.some(k=>meetingKeys.includes(k))&&current.link){const c=cardFor(t);await button('Жаңарту',c);await settled('Қосылым жаңартылуда');}return {link:current.link,lessonUrl:location.href};}
  const formErrors=()=>all('.mat-mdc-form-field-error,[role="alert"]').map(text).filter(s=>s&&!/сәтті|успешно/i.test(s));
  async function save(t){await ready(t);if(published().value)throw Error('Жарияланған сабақ өзгертілмейді.');const c=cardFor(t),link=unique(linkOf(c),'Meet сілтемесі');const errors=formErrors();if(errors.length)throw Error(errors.join('; '));const before=new Set(all('mat-snack-bar-container,.mat-mdc-snack-bar-container,[role="alert"]'));let pending=false;await button('Сақтау');await wait(()=>{const errors=formErrors();if(errors.length)throw Error(errors.join('; '));const b=exact('Сақтау','button')[0];if(b?.disabled||all('[role="progressbar"],mat-spinner,mat-progress-spinner').length)pending=true;return all('mat-snack-bar-container,.mat-mdc-snack-bar-container,[role="alert"]').some(e=>!before.has(e)&&/сәтті|успешно/i.test(text(e)))||pending&&b&&!b.disabled&&!all('[role="progressbar"],mat-spinner,mat-progress-spinner').length;},'Сақтау аяқталуда',45000);return {link,lessonUrl:location.href};}
  const dialogs=()=>all('[role="dialog"],mat-dialog-container');
  async function publish(t){await ready(t);if(!published().value){click(unique(published().controls.filter(e=>!isOn(e)),'Жариялау'));const next=await wait(()=>dialogs().find(e=>/жариялау|опубликовать/i.test(text(e)))||(published().value&&!dialogs().length?'published':null),'Жариялау растауы');if(next!=='published'){const confirm=all('button',next).filter(e=>/^(Жариялау|Растау|Иә|Опубликовать|Да)$/i.test(text(e)));click(unique(confirm,'Жариялау растауы'));}await wait(()=>published().value&&!dialogs().length,'Жариялау аяқталуда',45000);}return {lessonUrl:location.href};}
  async function unpublish(t){await ready(t);if(!published().value)return {lessonUrl:location.href};if(t.approvedUnpublish!==true)throw Error('Жарияланған сабақты түзету таңдалмаған.');click(unique(published().controls.filter(isOn),'Жариялауды өшіру'));await wait(()=>{const d=all('[role="dialog"],mat-dialog-container').find(e=>/Жариялаудан|жарияланымнан/i.test(text(e)));if(d)return d;return !published().value;},'Жариялауды өшіру');const d=all('[role="dialog"],mat-dialog-container').find(e=>/Жариялаудан|жарияланымнан/i.test(text(e)));if(d){const buttons=all('button',d).filter(e=>/^(Жариялаудан алу|Растау)$/i.test(text(e)));click(unique(buttons,'Жариялаудан алу растауы'));}await wait(()=>!published().value&&!all('[role="dialog"],mat-dialog-container').length,'Жариялау өшірілуде');return {lessonUrl:location.href};}
  function ratingSwitch(){const label='Рейтингке қосу',direct=all('[role="switch"],input[type="checkbox"]').filter(e=>norm(switchLabel(e))===norm(label));if(direct.length)return unique(direct,label);for(const marker of exact(label,'label,span,p,div')){let p=marker.parentElement;for(let i=0;i<4&&p;i++,p=p.parentElement){const found=all('[role="switch"],input[type="checkbox"]',p);if(found.length===1)return found[0];}}throw Error('ауыстырғыш табылмады');}
  // Read-only check of the open page: it only looks for the controls the automation needs.
  // It never clicks, types or opens a menu, so it is safe on a live lesson.
  function diagnose(){
    const checks=[],add=(label,ok,detail='')=>checks.push({label,ok:!!ok,detail:String(detail||'')});
    const probe=(label,fn,describe=()=>'табылды')=>{try{const value=fn();add(label,true,describe(value));return value;}catch(e){add(label,false,e.message);return null;}};
    const info=U.inspect();
    add('Курс атауы',info.name,info.name||'«SMART-PRO | …» атауы табылмады');
    add('Курс пәні',info.subjects.length,info.subjects.map(s=>M.subjects[s]).join(', ')||'атаудан пән танылмады');
    const page=all('#PRACTICAL_LESSON_NAME').length?'lesson':info.courseUrl?'course':'unknown';
    if(page==='lesson'){
      probe('Сабақ атауы өрісі',mainName,e=>clean(e.value)||'бос');
      const list=cards();add('Google Meet қосылымдары',list.length,list.length+' қосылым');
      list.forEach((c,i)=>{const n=i+1;
        for(const [key,label] of [['name','Студентке көрінетін атауы'],['date','Күн'],['startTime','Басталуы'],['endTime','Аяқталуы'],['deadlineDate','Дедлайн күні'],['deadlineTime','Дедлайн уақыты'],['meetingMaxScore','Қатысым баллы'],['minAttendancePercent','Қатысым пайызы']])probe(`${n}-қосылым: ${label}`,()=>fc(c,key),e=>(U.writable(e)?'өзгертуге болады':'тек оқу')+(e.type?' · '+e.type:''));
        probe(`${n}-қосылым: Топ`,()=>field('Топ',{root:c,kind:'select',readOnly:true}),e=>e.tagName.toLowerCase());
        probe(`${n}-қосылым: Ұйымдастырушы email-і`,()=>U.organizerControl(c),e=>U.organizerValue(e)?'мәні оқылды':'мәні оқылмады');
        const links=linkOf(c);add(`${n}-қосылым: Meet сілтемесі`,links.length<=1,links.length===1?'бар':links.length?'бірнеше сілтеме':'әлі құрылмаған');
      });
      probe('Конспект баллы',()=>fc(document,'maxScore'));
      probe('Тапсырма тегі',()=>field('Тапсырма тегін таңдау',{kind:'select',readOnly:true}),e=>U.selectedText(e)||'таңдалмаған');
      probe('«Рейтингке қосу» ауыстырғышы',ratingSwitch,e=>isOn(e)?'қосулы':'өшірулі');
      probe('Нұсқаулық редакторы',editor,e=>e.classList.contains('ck-editor__editable')?'CKEditor':'contenteditable');
      const pub=published();add('Жариялау ауыстырғышы',pub.controls.length,pub.controls.length?(pub.value?'жарияланған':'жарияланбаған'):'табылмады');
      probe('«Сақтау» батырмасы',()=>unique(exact('Сақтау','button,[role="button"]'),'Сақтау'));
      add('«Қосылым қосу» батырмасы',all('button').some(e=>/Қосылым қосу/i.test(text(e))),'');
    }else if(page==='course'){
      add('Әдіскер режимі',info.role==='methodist'||location.pathname.includes('/methodologist-mode/')||exact('Әдіскер режимі','button,[role="button"]').length===1,info.role==='methodist'?'әдіскер беті':location.pathname.includes('/methodologist-mode/')?'қосулы':'батырма');
      const month=all('mat-select,[role="combobox"]').find(e=>/^\d+\s*ай$/i.test(U.selectedText(e)));add('Ай мәзірі',month,month?U.selectedText(month):'табылмады');
      const weeks=all('button,[role="button"]').map(text).filter(s=>/^\d\s*апта$/i.test(s));add('Апта батырмалары',weeks.length,weeks.join(', ')||'табылмады');
      const themes=all('h1,h2,h3').map(text).filter(s=>/АЙ\s+\d+\s*-?\s*АПТА\s*\|\s*LIVE/i.test(s));add('LIVE тақырыптары',true,themes.join('; ')||'таңдалған аптада жоқ');
      add('«Тақырып қосу» батырмасы',all('.list__new_theme button').length===1,all('.list__new_theme button').length+' батырма');
      const lessons=all('h1,h2,h3').map(text).filter(s=>/LIVE\s*САБАҚ\s*№/i.test(s));add('LIVE сабақтары',true,lessons.join('; ')||'ашық тақырыпта жоқ');
    }else add('Бет түрі',false,'Курс немесе сабақ беті танылмады');
    const structure={
      formControls:[...new Set(all('[formcontrolname]').map(e=>e.getAttribute('formcontrolname')+':'+e.tagName.toLowerCase()))],
      buttons:[...new Set(all('button,[role="button"]').map(text).filter(Boolean))].slice(0,80),
      switches:all('[role="switch"],input[type="checkbox"]').map(e=>switchLabel(e)||'(жазусыз)').slice(0,30),
      dialogs:dialogs().length
    };
    return {url:location.origin+location.pathname,page,checks,structure};
  }
  const actions={inspect:courseInfo,diagnose,open,snapshot,createMeet,attach,fillNotes,patch,save,publish,unpublish};
  chrome.runtime.onMessage.addListener((m,sender,reply)=>{
    if(m.source!=='juz40-v1'||sender.id!==chrome.runtime.id)return;
    if(m.action==='stop'){U.stop();reply({ok:true});return;}
    if(!actions[m.action])return;if(busy){reply({ok:false,error:'Алдыңғы қадам әлі орындалып жатыр.'});return;}
    busy=true;U.reset();Promise.resolve().then(()=>actions[m.action](m.payload||{})).then(data=>{busy=false;reply({ok:true,data});},e=>{busy=false;reply({ok:false,error:e.message,safe:e.safe===true});});return true;
  });
})();

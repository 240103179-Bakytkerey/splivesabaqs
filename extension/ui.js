(() => {
  if(globalThis.LiveUIV1)return;
  let stopped=false,mapping={};
  const clean=s=>String(s||'').replace(/[\u200b\u2060\ufeff]/g,'').replace(/\s+/g,' ').trim();
  const norm=s=>clean(s).toLocaleLowerCase('kk');
  function editorText(e){
    if(e.tagName==='TEXTAREA')return clean(e.value);
    const blocks=e.querySelectorAll('p,li,h1,h2,h3,h4,blockquote');
    return clean(blocks.length?Array.from(blocks).filter(b=>!b.querySelector('p,li,h1,h2,h3,h4,blockquote')).map(b=>b.textContent).join('\n'):e.innerText||e.textContent);
  }
  const visible=e=>Boolean(e&&e.getClientRects().length)&&getComputedStyle(e).visibility!=='hidden';
  const all=(selector,root=document)=>Array.from(root.querySelectorAll(selector)).filter(visible);
  const controls='input:not([type="hidden"]),textarea,select,mat-select,ng-select,[role="combobox"],[contenteditable="true"]';
  const text=e=>clean(e?.textContent||e?.value);
  function stage(t,detail){if(t?.jobId&&chrome.runtime.sendMessage)chrome.runtime.sendMessage({source:'juz40-v1-progress',jobId:t.jobId,detail}).catch(()=>{});}
  function unique(xs,label){xs=[...new Set(xs)];if(xs.length!==1)throw new Error(`${label}: ${xs.length?'бірнеше өріс табылды':'өріс табылмады'}. Форманы тексеріңіз.`);return xs[0];}
  function exact(label,selector='button,[role="button"],mat-option,[role="option"],h1,h2,h3,span,p,label',root=document){return all(selector,root).filter(e=>norm(text(e))===norm(label));}
  async function wait(fn,label,ms=30000){const end=Date.now()+ms;while(Date.now()<end){if(stopped)throw new Error('Кезек тоқтатылды.');const v=fn();if(v)return v;await new Promise(r=>setTimeout(r,100));}throw new Error(`${label}: платформа жауап бермеді.`);}
  async function waitQuietly(fn,ms){const end=Date.now()+ms;while(Date.now()<end){if(fn())return true;await new Promise(r=>setTimeout(r,100));}return !!fn();}
  async function settled(label){let changed=Date.now();const observer=new MutationObserver(()=>changed=Date.now());observer.observe(document.body,{childList:true,subtree:true,characterData:true});try{await wait(()=>!all('mat-spinner,mat-progress-spinner,[role="progressbar"]').length&&Date.now()-changed>=400,label);}finally{observer.disconnect();}}
  function click(e){if(stopped)throw new Error('Кезек тоқтатылды.');if(!visible(e)||e.disabled||e.getAttribute('aria-disabled')==='true')throw new Error('Батырма қолжетімсіз. Міндетті өрістерді тексеріңіз.');e.scrollIntoView({block:'center'});e.click();}
  async function button(label,root=document){const e=unique(exact(label,'button,[role="button"]',root),label);await wait(()=>!e.disabled&&e.getAttribute('aria-disabled')!=='true',label,3000);click(e);}
  function writable(e){return !e.disabled&&!e.readOnly&&e.getAttribute('aria-disabled')!=='true'&&!['button','checkbox','radio','submit','file'].includes(e.type);}
  function field(label,{root=document,kind='input',optional=false,readOnly=false}={}){
    const candidates=[];
    const formNames={'Сабақ атауы':'name','Қатысым үшін балл':'meetingMaxScore','Шектік қатысым пайызы':'minAttendancePercent','Тапсырма үшін балл':'maxScore','Топ':'groupIds','Ұйымдастырушының email-і':'organizerEmail','Тапсырма тегін таңдау':'ratingTaskType'};
    const formName=formNames[label];if(formName){const selector=kind==='select'?'mat-select,select,ng-select':'input,textarea';for(const wrapper of all(`[formcontrolname="${formName}"]`,root)){if(wrapper.matches(selector))candidates.push(wrapper);else candidates.push(...all(selector,wrapper));}}
    const match=v=>v&&norm(v).replace(/\s*\*$/,'')===norm(label);
    for(const e of all(controls,root)){const labelled=(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)).filter(Boolean).map(text).join(' ');if([e.placeholder,e.getAttribute('aria-label'),e.getAttribute('formcontrolname'),labelled].some(match))candidates.push(e);}
    for(const marker of all('label,mat-label,span,p,div,input,h1,h2,h3',root).filter(e=>match(text(e)))){
      if(marker.tagName==='LABEL'&&marker.htmlFor){const e=document.getElementById(marker.htmlFor);if(e&&visible(e))candidates.push(e);}
      let p=marker.parentElement;
      for(let i=0;i<5&&p&&(root===document||root.contains(p));i++,p=p.parentElement){let cs=all(controls,p).filter(e=>readOnly||writable(e));if(kind==='input')cs=cs.filter(e=>['INPUT','TEXTAREA'].includes(e.tagName));else if(kind==='select')cs=cs.filter(e=>e.matches('select,mat-select,ng-select,[role="combobox"]'));if(cs.length===1){candidates.push(cs[0]);break;}if(cs.length>4)break;}
    }
    const xs=[...new Set(candidates)].filter(e=>readOnly||writable(e));if(optional&&!xs.length)return null;return unique(xs,label);
  }
  function set(e,value){if(stopped)throw new Error('Кезек тоқтатылды.');if(e.value===String(value))return;if(!writable(e)){throw new Error('Бұл өрісті өзгертуге болмайды. Қосылымды тексеріңіз.');}e.focus();const descriptor=Object.getOwnPropertyDescriptor(e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value');descriptor.set.call(e,String(value));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));e.dispatchEvent(new Event('blur',{bubbles:true}));if(e.value!==String(value))throw new Error('Өріс мәнді қабылдамады.');}
  function mapped(key,fallback){const saved=mapping[key];if(!saved)return fallback();const es=all(saved.selector);const e=es[saved.index];if(!e||e.tagName!==saved.tag||e.type!==saved.type)throw new Error('Өріс сәйкестендіруі өзгерген: '+key);return e;}
  function setDate(e,value){set(e,e.type==='date'?value:value.split('-').reverse().join('.'));}
  function selectedText(control){if(control.tagName==='SELECT')return Array.from(control.selectedOptions).map(text).join(' ');const value=control.querySelector('.month-select__trigger-text,.mat-mdc-select-value-text,.ng-value-label');return value?text(value):text(control);}
  function emailToken(value){const values=String(value||'').replace(/[\u200b-\u200f\u202a-\u202e\u2060\u2066-\u2069\ufeff]/g,'').match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)||[];return values.length===1?values[0].toLowerCase():'';}
  function organizerControl(root=document){return field('Ұйымдастырушының email-і',{root,kind:'select',readOnly:true});}
  function organizerValue(control=organizerControl()){
    if(control.tagName==='SELECT')return emailToken(Array.from(control.selectedOptions).map(text).join(' '));
    const trigger=control.querySelector('.mat-mdc-select-trigger,.mat-select-trigger,.ng-value,.mat-mdc-select-value-text');
    const root=trigger||control,walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node,value='';
    while(node=walker.nextNode()){const parent=node.parentElement;if(parent&&visible(parent)&&!parent.closest('mat-option,[role="option"],[role="listbox"],label,mat-label,[aria-hidden="true"]'))value+=' '+node.textContent;}
    return emailToken(value);
  }
  function verifyOrganizer(expected,control=organizerControl()){const actual=organizerValue(control);if(actual!==emailToken(expected))throw new Error(`Ұйымдастырушы email-і сәйкес емес. Күтілгені: ${expected}; таңдалғаны: ${actual||'мән оқылмады (әлі жүктелмеген болуы мүмкін)'}.`);}
  async function chooseOrganizer(control,expected){if(organizerValue(control)===emailToken(expected))return;if(!writable(control)){verifyOrganizer(expected,control);return;}
    if(control.tagName==='SELECT'){const option=unique(Array.from(control.options).filter(o=>emailToken(text(o))===emailToken(expected)),'Ұйымдастырушы email-і');await choose(control,text(option));return;}
    openSelect(control);const option=await wait(()=>all('mat-option,[role="option"],.ng-option',selectPanel(control)).find(e=>emailToken(text(e))===emailToken(expected)),'Ұйымдастырушы email-і');click(option);await wait(()=>organizerValue(control)===emailToken(expected)&&control.getAttribute('aria-expanded')!=='true','Email таңдауы');
  }
  function openSelect(control){if(control.getAttribute('aria-expanded')==='true')return;const trigger=control.querySelector('.mat-mdc-select-trigger,.ng-select-container');click(trigger&&visible(trigger)?trigger:control);}
  function selectPanel(control){const id=control.getAttribute('aria-controls')||control.getAttribute('aria-owns');return id&&document.getElementById(id)||document;}
  async function closeGroups(control,panel){
    const current=()=>control.isConnected?control:control.id&&document.getElementById(control.id);
    const closed=()=>{const active=current();if(panel!==document&&(!panel.isConnected||!visible(panel)))return true;return active&&active.getAttribute('aria-expanded')!=='true'&&!all('mat-option,[role="option"],.ng-option',panel).length;};
    if(closed())return;
    // «Қолдану» applies a changed selection. Without changes it stays disabled, and the panel is closed like a person
    // would: a click outside (the overlay backdrop), or Escape. On the site (22.10.2026) the backdrop has no
    // «-showing» class, and Angular Material reads Escape only from keyCode 27.
    const apply=exact('Қолдану','button',panel).find(e=>!e.disabled&&e.getAttribute('aria-disabled')!=='true');
    if(apply){click(apply);if(await waitQuietly(closed,3000))return;}
    const backdrop=all('.cdk-overlay-backdrop').at(-1);
    if(backdrop){backdrop.click();if(await waitQuietly(closed,1500))return;}
    (current()||control).dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));
    await wait(closed,'Топтар тізімін жабу',5000);
  }
  async function choose(control,label){if(norm(selectedText(control))===norm(label)&&control.getAttribute('aria-expanded')!=='true')return;if(!writable(control)){throw new Error('Таңдау жабық және мәні сәйкес емес: '+label);}if(control.tagName==='SELECT'){const option=unique(Array.from(control.options).filter(o=>norm(o.textContent)===norm(label)),label);control.value=option.value;control.dispatchEvent(new Event('change',{bubbles:true}));return;}
    if(norm(selectedText(control))===norm(label)&&control.getAttribute('aria-expanded')!=='true')return;
    openSelect(control);const option=await wait(()=>exact(label,'mat-option,[role="option"],.ng-option',selectPanel(control)).find(visible),label);click(option);await wait(()=>norm(selectedText(control))===norm(label)&&control.getAttribute('aria-expanded')!=='true',label+' таңдау',5000);
  }
  async function toggle(label){const direct=all('[role="switch"],input[type="checkbox"]').filter(e=>norm(e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||e.labels?.[0]?.textContent)===norm(label));if(direct.length===1){const e=direct[0];if(e.getAttribute('aria-checked')!=='true'&&!e.checked)click(e);return;}const markers=all('label,span,p,div').filter(e=>norm(text(e))===norm(label));for(const m of markers){let p=m.parentElement;for(let i=0;i<4&&p;i++,p=p.parentElement){const switches=all('[role="switch"],input[type="checkbox"]',p);if(switches.length===1){const e=switches[0];if(e.getAttribute('aria-checked')!=='true'&&!e.checked)click(e);return;}}}throw new Error(`${label}: ауыстырғыш табылмады.`);}
  function switchEnabled(label){const direct=all('[role="switch"],input[type="checkbox"]').find(e=>norm(e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||e.labels?.[0]?.textContent)===norm(label));if(direct)return direct.getAttribute('aria-checked')==='true'||direct.checked===true;for(const marker of exact(label,'label,span,p,div')){let p=marker.parentElement;for(let i=0;i<4&&p;i++,p=p.parentElement){const controls=all('[role="switch"],input[type="checkbox"]',p);if(controls.length===1)return controls[0].getAttribute('aria-checked')==='true'||controls[0].checked===true;}}return false;}
  function inspect(){const header=all('.course__name').find(e=>/^SMART[- ]PRO\s*\|/i.test(text(e)));const name=header?text(header):all('p,h1,h2').map(text).find(t=>/^SMART[- ]PRO\s*\|/i.test(t))||'';const u=new URL(location.href);u.searchParams.delete('themeId');u.searchParams.delete('isShuffleMode');
    const role=u.pathname.startsWith('/methodist/')?'methodist':'headTeacher';const coursePath=u.pathname.match(/^\/headTeacher\/subjects\/[^/]+\/[^/]+/)||u.pathname.match(/^\/methodist\/course\/[0-9a-f-]{36}/);const courseUrl=coursePath?u.origin+coursePath[0]:null;
    const parts=name.split('|').map(x=>norm(x));const subjectCode=parts.at(-2);const aliases={ms:['мс','мат сау','матсау','математикалық сауаттылық'],physics:['физ','физика'],geometry:['геом','геометрия'],chemistry:['хим','химия'],math:['мат','математика'],info:['инфо','информатика'],geo:['гео','география'],wh:['джт','дүниежүзі тарихы'],bio:['био','биология'],kazlit:['әдеб','әдебиет','қазақ әдебиеті'],kaz:['тіл','қазақ тілі'],hist:['тарих','қазақстан тарихы'],rus:['рус','орыс тілі','русский язык'],ruslit:['лит','русская литература'],law:['құқық','құқық негіздері']};let subject=Object.keys(aliases).find(k=>aliases[k].includes(subjectCode));let subjects=subject?[subject]:[];if(subjectCode?.replace(/\s/g,'')==='мс+геом'){subject='ms';subjects=['ms','geometry'];}return {name,courseUrl,subject,subjects,role};}
  async function checkCourse(t){const c=await wait(()=>{const info=inspect();return info.name&&(!t.courseName||norm(info.name)===norm(t.courseName))?info:null;},'Курс деректері жүктелуде',20000);if(t.courseId&&c.courseUrl?.split('/').at(-1)!==t.courseId)throw new Error('Ашылған курс сілтемесі кезектегі курсқа сәйкес емес.');if(!norm(c.name).includes(norm(t.streamName)))throw new Error('Ағым сәйкес емес.');if(!c.subjects.includes(t.subject))throw new Error('Курстың пәні сәйкес емес немесе атауы танылмады.');return c;}
  async function allGroups(control){if(control.tagName==='SELECT'){if(!control.multiple&&control.options.length>2)throw new Error('Топ өрісі бірнеше топты таңдауды қолдамайды.');for(const o of control.options)if(o.value&&!o.disabled)o.selected=true;control.dispatchEvent(new Event('change',{bubbles:true}));return;}
    openSelect(control);await wait(()=>all('mat-option,[role="option"],.ng-option',selectPanel(control)).length,'Топтар тізімі');await settled('Топтар тізімінің жүктелуі');const opts=all('mat-option,[role="option"],.ng-option',selectPanel(control));if(!opts.length)throw new Error('Курста топ жоқ.');
    const selectAll=opts.find(e=>/^(барлығын таңдау|таңдау барлық|выбрать все|select all)$/i.test(text(e)));
    const panel=selectPanel(control),selectAllButton=exact('Бәрін таңдау','button',panel)[0];
    if(selectAllButton)click(selectAllButton);
    else if(selectAll){if(selectAll.getAttribute('aria-selected')!=='true')click(selectAll);}else{
      const labels=opts.filter(e=>e.getAttribute('aria-disabled')!=='true'&&!/^(тізімнен таңдаңыз|таңдаңыз)$/i.test(text(e))).map(text);if(!labels.length)throw new Error('Қолжетімді топ жоқ.');
      for(const label of labels){const option=all('mat-option,[role="option"],.ng-option',panel).find(e=>text(e)===label);if(!option)throw new Error('Барлық топты таңдау аяқталмады. Тізімді тексеріңіз.');if(!optionSelected(option)){click(option);await wait(()=>{const current=all('mat-option,[role="option"],.ng-option',panel).find(e=>text(e)===label);return current&&optionSelected(current);},'Топ таңдау: '+label,5000);}}
    }
    await wait(()=>{const enabled=all('mat-option,[role="option"],.ng-option',panel).filter(e=>e.getAttribute('aria-disabled')!=='true'&&e!==selectAll);return enabled.length&&enabled.every(optionSelected);},'Барлық топтың таңдалуын растау',5000);
    await closeGroups(control,panel);await verifyGroups(control);
  }
  function optionSelected(e){return e.getAttribute('aria-selected')==='true'||e.classList.contains('mdc-list-item--selected')||e.classList.contains('mat-mdc-option-multiple-selected')||e.classList.contains('ng-option-selected');}
  async function verifyGroups(controlOverride){const control=controlOverride||mapped('group',()=>field('Топ',{kind:'select'}));if(control.tagName==='SELECT'){const options=Array.from(control.options).filter(o=>o.value&&!o.disabled);if(!options.length||options.some(o=>!o.selected))throw new Error('Барлық топ таңдалмаған.');return;}
    openSelect(control);const panel=selectPanel(control);await wait(()=>all('mat-option,[role="option"],.ng-option',panel).length,'Сақталған топтарды тексеру');
    try{await wait(()=>{const options=all('mat-option,[role="option"],.ng-option',panel).filter(e=>e.getAttribute('aria-disabled')!=='true'&&!/^(барлығын таңдау|таңдау барлық|выбрать все|select all)$/i.test(text(e)));return options.length&&options.every(optionSelected);},'Қайта ашылған сабақта барлық топ сақталмаған',5000);}
    finally{if(!stopped)await closeGroups(control,panel);}
  }

  globalThis.LiveUIV1={clean,norm,editorText,visible,all,text,stage,unique,exact,wait,waitQuietly,settled,click,button,writable,field,set,setDate,selectedText,emailToken,organizerControl,organizerValue,chooseOrganizer,openSelect,selectPanel,closeGroups,choose,toggle,switchEnabled,inspect,checkCourse,allGroups,verifyGroups,optionSelected,reset:()=>{stopped=false;},stop:()=>{stopped=true;}};
})();


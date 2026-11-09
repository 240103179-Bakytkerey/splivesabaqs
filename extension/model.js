(function(root) {
  'use strict';
  const subjects = {math:'Математика', ms:'Математикалық сауаттылық', geometry:'Геометрия', physics:'Физика', chemistry:'Химия', info:'Информатика',
    geo:'География', wh:'Дүниежүзі тарихы', bio:'Биология', kazlit:'Қазақ әдебиеті', kaz:'Қазақ тілі', hist:'Қазақстан тарихы', rus:'Русский язык', ruslit:'Русская литература', law:'Құқық негіздері'};
  // 1.3.0: «ЕСЕП ПӘН» (есеп шығарылатын пәндер) және «АУЫЗША/ЖАЗБАША ПӘН». Сілтемелер мәтіні мен Meet ұйымдастырушысы осыған бөлінеді.
  const categories = {esep:{title:'ЕСЕП ПӘН'}, auyzsha:{title:'АУЫЗША/ЖАЗБАША ПӘН'}};
  const esepSubjects = new Set(['math','ms','geometry','physics','chemistry','info']);
  const category = subject => esepSubjects.has(subject) ? 'esep' : 'auyzsha';
  // Course-name codes (SMART-PRO | <бағыт> | <код> | <ай>) and the ways a subject is written in the link messages.
  const codes = {math:'МАТ', ms:'МС', geometry:'ГЕОМ', physics:'ФИЗ', chemistry:'ХИМ', info:'ИНФО', geo:'ГЕО', wh:'ДЖТ', bio:'БИО', kazlit:'ӘДЕБ', kaz:'ТІЛ', hist:'ТАРИХ', rus:'РУС', ruslit:'ЛИТ', law:'ҚҰҚЫҚ'};
  const extraNames = {wh:['ДҮНИЕЖҮЗІ ТАРИХЫ','ДҮНИЕЖҮЗІ'], kazlit:['ӘДЕБИЕТ','ҚАЗАҚ ӘДЕБИЕТІ','ҚАЗ ӘДЕБ'], kaz:['ҚАЗАҚ ТІЛІ','ҚАЗ ТІЛ','ҚАЗАҚ ТІЛ'], hist:['ҚАЗАҚСТАН ТАРИХЫ','ҚАЗ ТАРИХ','ҚАЗАҚСТАН ТАРИХ','ҚТ'], rus:['ОРЫС ТІЛІ','РУССКИЙ','РУС ТІЛІ'], ruslit:['ОРЫС ӘДЕБИЕТІ','РУССКАЯ ЛИТЕРАТУРА','ЛИТЕРАТУРА'], law:['ҚҰҚЫҚ НЕГІЗДЕРІ','ҚҰҚЫҚ'], bio:['БИОЛОГИЯ'], geo:['ГЕОГРАФИЯ']};
  const clean = value => String(value ?? '').replace(/[\u200b-\u200f\u2060\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const norm = value => clean(value).toLocaleUpperCase('kk');
  const direction = value => norm(value).replace(/[\s\-–—]/g, '');
  // Short combination codes used in the link messages («КОМБИНАЦИЯ: ИМ, ГМ»). A code may stand for several catalogue
  // spellings of the same direction (ГЕО-АНГЛ in one stream, ГЕО-АНГЛ IELTS in another).
  // 1.3.1: ДАА = ДЖТ-АНГЛ IELTS, ДАТ = ДЖТ-АНГЛ TOEFL, БГ = ГЕО-БИО (as ГБ).
  const aliases = {ИМ:['ИНФОМАТ'],ФМ:['ФИЗМАТ'],ГМ:['ГЕОМАТ'],БХ:['БИОХИМ'],ФХ:['ФИЗХИМ'],ГБ:['ГЕОБИО'],БГ:['ГЕОБИО'],ГД:['ГЕОДЖТ'],ӘТ:['ӘДЕБТІЛ'],РЛ:['РУСЛИТ'],ДҚ:['ДЖТҚҰҚЫҚ'],ГА:['ГЕОАНГЛ','ГЕОАНГЛIELTS'],ДАА:['ДЖТАНГЛIELTS'],ДАТ:['ДЖТАНГЛTOEFL']};
  // Parts are separated by commas; a part made only of short codes may also be separated by spaces («ӘТ РЛ ДАТ»).
  const directions = value => String(value).split(/[,;]/).flatMap(part => { const words=clean(part).split(' ').map(direction); return words.length>1&&words.every(w=>aliases[w]) ? words : [direction(part)]; }).flatMap(v => aliases[v] || [v]).filter(Boolean);
  const subjectAliases = {...Object.fromEntries(Object.entries(codes).map(([k,v]) => [v, k])),...Object.fromEntries(Object.entries(extraNames).flatMap(([k,list]) => list.map(v => [norm(v), k]))),...Object.fromEntries(Object.entries(subjects).map(([k,v]) => [norm(v), k]))};
  const template = `Сәлем, жас түлек!\n\nНазарыңа {пән} пәнінен LIVE сабақты ұсынамыз.\n\nLIVE САБАҚТЫ ҚАРАУ ЕРЕЖЕЛЕРІ:\n\n1. Камера қосып, маскасыз отырыңыз\n2. Сабақты мұқият қарап, тақырыпты толық түсінуге тырысыңыз.\n3. Маңызды ақпараттарды жазып алып, қиын тұстарын қайта қарап шығыңыз.\n4. Чат тәртібін сақтаңыз\n5. Сұрақтар туындаса, міндетті түрде қойыңыз - бұл сіздің нәтижеңізге тікелей әсер етеді\n\nЕСКЕРТУ:\nСабақты толық меңгермей, келесі тақырыпқа өтпеңіз.\nCӘТТІЛІК! ГРАНТ ЖАҒАСЫНА БІЗБЕН БІРГЕ JUZ!`;
  function defaults() { return {year:new Date().getFullYear(), email:'smartpro_esep@juz40onl.com', emailAuyzsha:'smartpro_auyzsha@juz40onl.com', week:3, attendance:30, percent:70, points:25, deadlineDays:1, deadlineTime:'23:59', instruction:template, offsets:{math:0,ms:-1,geometry:-1,physics:0,chemistry:0,info:0,geo:0,wh:0,bio:0,kazlit:0,kaz:0,hist:-1,rus:0,ruslit:0,law:0}, streams:[{id:'aug',code:'SP-1',name:'Тамыз',month:4,number:11},{id:'sep',code:'SP-2',name:'Қыркүйек',month:3,number:7},{id:'oct',code:'SP-3',name:'Қазан',month:2,number:3}]}; }
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value+'T12:00:00Z')) && new Date(value+'T12:00:00Z').toISOString().slice(0,10) === value;
  const validTime = value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  function addDays(date, days) { if (!validDate(date) || !Number.isInteger(Number(days))) throw Error('Күнді тексеріңіз.'); const d=new Date(date+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+Number(days)); return d.toISOString().slice(0,10); }
  function dateFrom(text, year) { const m=String(text).match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\b/); return m ? `${m[3]||year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}` : ''; }
  const id = () => root.crypto?.randomUUID?.() || 'id-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  // The Meet organizer depends on the subject group (ЕСЕП / АУЫЗША-ЖАЗБАША).
  const emailFor = (settings, subject) => category(subject)==='auyzsha' ? (settings.emailAuyzsha||defaults().emailAuyzsha) : settings.email;
  function makeRow(settings, patch={}) { const stream=settings.streams.find(s=>s.id===patch.stream)||settings.streams[0]; return {id:id(),stream:stream.id,subject:'math',teacher:'',date:'',start:'',end:'',cohort:1,number:stream.number,month:stream.month,week:settings.week,directions:[],courseIds:[],email:emailFor(settings,patch.subject||'math'),attendance:settings.attendance,percent:settings.percent,points:settings.points,deadlineDays:settings.deadlineDays,deadlineTime:settings.deadlineTime,enabled:true,...patch}; }
  function parse(text, settings) {
    const rows=[], warnings=[]; let context={}, pending='', row=null;
    const finish=()=>{if(row){rows.push(row);row=null;}};
    for(const [i,original] of String(text).split(/\r?\n/).entries()) {
      const line=clean(original.replace(/\*\*/g,'').replace(/&#x20;|&#xA0;|&nbsp;/gi,' ')); if(!line)continue;
      const header=line.match(/\bSP\s*[-–]?\s*(\d+)\b/i);
      if(header) {finish();const stream=settings.streams.find(s=>norm(s.code).replace(/\s/g,'')==='SP-'+header[1]);context={stream:stream?.id||'',date:dateFrom(line,settings.year)};if(!stream)warnings.push(`${i+1}-жол: SP-${header[1]} ағымын баптауларға қосыңыз.`);pending='';continue;}
      if(/^\d{1,2}\.\d{1,2}(?:\.|\b)/.test(line)){const target=row||context;target.date=dateFrom(line,settings.year);const month=line.match(/(\d+)\s*[-–]?\s*ай/i),week=line.match(/(\d+)\s*[-–]?\s*апта/i);if(month)target.month=Number(month[1]);if(week)target.week=Number(week[1]);continue;}
      const directionStream=line.match(/^([А-ЯӘІҢҒҮҰҚӨҺ]+)\s*[-–]\s*(\d+)$/i);
      if(directionStream){const stream=settings.streams.find(s=>s.code==='SP-'+directionStream[2]);if(stream){context.stream=stream.id;pending=directionStream[1];continue;}}
      const field=line.match(/(?:^|\s)(ПӘН|МҰҒАЛІМ|ПОТОК|АҒЫМ|УАҚЫТЫ|КҮНІ|СІЛТЕМЕ|ЖАУАПТЫ|КОМБИНАЦИЯ|КОМБИНАЦИЯЛАР|БАҒЫТ|БАҒЫТТАР)\s*:\s*(.*)$/i);
      if(field) {
        const key=norm(field[1]), value=clean(field[2]);
        if(key==='ПӘН') {finish();const subject=subjectAliases[norm(value)]||'';const s=settings.streams.find(s=>s.id===context.stream);row=makeRow(settings,{...context,subject,directions:directions(pending),month:(s?.month||1)+Number(settings.offsets[subject]||0),number:s?.number||1,sourceLine:i+1});if(!subject)warnings.push(`${i+1}-жол: «${value}» пәні танылмады.`);pending='';}
        // «КОМБИНАЦИЯ:» may come before ПӘН (it then waits for the next lesson) or after it (it belongs to this lesson).
        else if(/^(КОМБИНАЦИЯ|КОМБИНАЦИЯЛАР|БАҒЫТ|БАҒЫТТАР)$/.test(key)){if(row&&!row.directions.length)row.directions=directions(value);else pending=value;}
        else if(row&&key==='МҰҒАЛІМ')row.teacher=value;
        else if(row&&['ПОТОК','АҒЫМ'].includes(key))row.cohort=Number(value);
        else if(row&&key==='КҮНІ')row.date=dateFrom(value,settings.year);
        else if(row&&key==='УАҚЫТЫ') {const m=value.match(/^(\d{1,2}:[0-5]\d)\s*[-–—]\s*(\d{1,2}:[0-5]\d)$/);if(m){row.start=m[1].padStart(5,'0');row.end=m[2].padStart(5,'0');}else warnings.push(`${i+1}-жол: уақыт «15:00-16:30» түрінде болуы керек.`);}
        continue;
      }
      // Contact lines («ЖАУАПТЫ: @…», «мұғаліміміз: @adilet_tarih 🎩») and links are not part of the schedule.
      if(/(^|\s)@[\w.]+/.test(line)||/https?:\/\//.test(line))continue;
      if(/^[А-ЯӘІҢҒҮҰҚӨҺA-Z0-9\s,;\-–]+$/i.test(line))pending=line;
      else warnings.push(`${i+1}-жол танылмады: ${line}`);
    }
    finish(); if(!rows.length)warnings.push('Сабақтар табылмады. SP, ПӘН, МҰҒАЛІМ және УАҚЫТЫ жолдарын тексеріңіз.');
    return {rows,warnings};
  }
  function courseId(url) {try {const u=new URL(url);if(u.origin!=='https://juz40-edu.kz')return '';return u.pathname.match(/^\/headTeacher\/subjects\/[^/]+\/([^/]+)/)?.[1]||u.pathname.match(/^\/methodist\/course\/([^/]+)/)?.[1]||'';}catch{return '';}}
  function matches(row,catalog) {return catalog.filter(c=>c.stream===row.stream&&c.subjects.includes(row.subject)&&row.directions.includes(direction(c.direction)));}
  function fingerprint(value) {return JSON.stringify(value);}
  function task(row,settings) {
    const stream=settings.streams.find(s=>s.id===row.stream);
    const title=`LIVE САБАҚ №${row.number} | ${norm(row.teacher)} | ${row.cohort}-АҒЫМ`;
    const theme=`${row.month}-АЙ ${row.week}-АПТА | LIVE САБАҚ`;
    return {...row,streamName:stream?.name||'',streamCode:stream?.code||'',subjectName:subjects[row.subject]||'',title,theme,studentTitle:theme+' | '+norm(row.teacher),deadline:addDays(row.date,row.deadlineDays),instruction:settings.instruction.replaceAll('{пән}',subjects[row.subject]||'')};
  }
  function validate(row,settings,catalog) {
    const errors=[];
    if(!settings.streams.some(s=>s.id===row.stream))errors.push('Ағым таңдалмаған');
    if(!subjects[row.subject])errors.push('Пән таңдалмаған');
    if(!clean(row.teacher))errors.push('Мұғалім жазылмаған');
    if(!validDate(row.date))errors.push('Күн дұрыс емес');
    if(!validTime(row.start)||!validTime(row.end)||row.start>=row.end)errors.push('Басталу/аяқталу уақыты дұрыс емес');
    for(const [key,label,min,max] of [['month','Ай',1,12],['week','Апта',1,4],['number','LIVE №',1,999],['cohort','Поток',1,99],['attendance','Қатысым баллы',0,1000],['percent','Қатысым пайызы',0,100],['points','Конспект баллы',0,1000],['deadlineDays','Дедлайн күні',0,365]])if(!Number.isInteger(Number(row[key]))||row[key]===''||Number(row[key])<min||Number(row[key])>max)errors.push(label+' дұрыс емес');
    if(!validTime(row.deadlineTime))errors.push('Дедлайн уақыты дұрыс емес');
    if(validDate(row.date)&&validTime(row.end)&&validTime(row.deadlineTime)&&Number(row.deadlineDays)===0&&row.deadlineTime<row.end)errors.push('Дедлайн сабақ аяқталғаннан кейін болуы керек');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))errors.push('Email дұрыс емес');
    if(!settings.instruction.trim())errors.push('Нұсқаулық бос');
    if(!row.courseIds.length)errors.push('Курс таңдалмаған');
    for(const cid of row.courseIds){const c=catalog.find(c=>c.id===cid);if(!c||!courseId(c.url))errors.push('Курс сілтемесі жарамсыз');else if(c.stream!==row.stream||!c.subjects.includes(row.subject))errors.push('Курс ағымға немесе пәнге сәйкес емес: '+c.name);}
    return errors;
  }
  function plan(rows, settings, catalog) {
    const jobs=[], errors=[];const seen=new Set();
    for(const row of rows.filter(r=>r.enabled)) {
      const invalid=validate(row,settings,catalog);if(invalid.length){errors.push({rowId:row.id,errors:invalid});continue;}
      const t=task(row,settings);
      for(const cid of row.courseIds) {
        const course=catalog.find(c=>c.id===cid), logical=JSON.stringify([cid,t.month,t.week,t.title]);
        if(seen.has(logical)){errors.push({rowId:row.id,errors:['Бір курста бірдей атаулы екі сабақ бар. LIVE № немесе потокты ажыратыңыз.']});continue;}
        seen.add(logical);
        const expected={...t,courseId:cid,courseName:course.name,courseUrl:course.url};
        jobs.push({id:row.id+'|'+cid,rowId:row.id,sourceCourseId:row.courseIds[0],course,task:expected,revision:fingerprint(expected)});
      }
    }
    return {jobs:jobs.sort((a,b)=>a.task.date.localeCompare(b.task.date)||a.task.start.localeCompare(b.task.start)),errors};
  }
  const fieldLabels={title:'Сабақ атауы',studentTitle:'Студентке көрінетін атауы',date:'Күн',start:'Басталуы',end:'Аяқталуы',deadline:'Дедлайн күні',deadlineTime:'Дедлайн уақыты',attendance:'Қатысым баллы',percent:'Қатысым пайызы',email:'Email',groups:'Топтар',points:'Конспект баллы',tag:'Тапсырма тегі',rating:'Рейтингке қосу',instruction:'Нұсқаулық',link:'Meet сілтемесі'};
  function diff(expected, actual) {
    const wanted={...expected,groups:true,tag:'Live сабақ',rating:true};
    return Object.entries(fieldLabels).filter(([key])=>key!=='link'&&!actual.inherited?.[key]).filter(([key])=>key==='email'?norm(wanted[key])!==norm(actual[key]):clean(wanted[key])!==clean(actual[key])).map(([key,label])=>({key,label,before:actual[key]??'',after:wanted[key],editable:actual.editable?.[key]!==false}));
  }
  const validLink = link => /^https:\/\/meet\.google\.com\/[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(link||'');
  function report(records) {
    const groups=new Map();for(const r of records.filter(r=>r.verified&&r.published&&validLink(r.link))){const t=r.task,k=JSON.stringify([t.id,t.date,t.start,r.link]);if(!groups.has(k))groups.set(k,{t,link:r.link,courses:[]});groups.get(k).courses.push(direction(r.course.direction));}
    // Each day + stream gets one block per subject group: ЕСЕП ПӘН first, then АУЫЗША/ЖАЗБАША ПӘН (🎙 header).
    const icons={math:'🔢',ms:'🧮',geometry:'📐',physics:'🧲',chemistry:'⚗️',info:'💻',geo:'🌍',wh:'🏛',bio:'🧬',kazlit:'📖',kaz:'✍️',hist:'📜',rus:'🔤',ruslit:'📚',law:'⚖️'};
    const heads={esep:'🖥',auyzsha:'🎙'},order=c=>c==='esep'?0:1;let out='',header='';
    for(const {t,link,courses} of [...groups.values()].sort((a,b)=>a.t.date.localeCompare(b.t.date)||a.t.streamCode.localeCompare(b.t.streamCode)||order(category(a.t.subject))-order(category(b.t.subject))||a.t.start.localeCompare(b.t.start))) {
      const c=category(t.subject),h=t.date+'|'+t.streamCode+'|'+c;if(h!==header){out+=(out?'\n\n':'')+`${heads[c]} ${t.date.slice(8)}.${t.date.slice(5,7)} | ${t.streamCode} ${categories[c].title} LIVE САБАҚ СІЛТЕМЕЛЕРІ`;header=h;}
      out+=`\n\n${[...new Set(courses)].join(', ')}\n${icons[t.subject]||''} ПӘН: ${norm(t.subjectName)}\nМҰҒАЛІМ: ${norm(t.teacher)}\nПОТОК: ${t.cohort}\nУАҚЫТЫ: ${t.start}-${t.end}\nСІЛТЕМЕ: ${link}\nЖАУАПТЫ: `;
    }return out;
  }
  const api={subjects,categories,category,codes,subjectAliases,emailFor,clean,norm,direction,directions,defaults,validDate,validTime,addDays,dateFrom,makeRow,parse,courseId,matches,task,validate,plan,fingerprint,fieldLabels,diff,validLink,report};
  if(typeof module!=='undefined')module.exports=api;else root.LiveModel=api;
})(globalThis);

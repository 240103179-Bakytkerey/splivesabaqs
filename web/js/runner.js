(function(root){
  'use strict';
  const M=typeof module!=='undefined'?require('./model.js'):root.LiveModel;
  const mutations=new Set(['createMeet','attach','fillNotes','patch','save','publish','unpublish','openCreate']);
  const labels={open:'Сабақты іздеу',openCreate:'Сабақ ашу',snapshot:'Өрістерді тексеру',createMeet:'Meet құру',attach:'Қосылымды байланыстыру',fillNotes:'Конспект пен нұсқаулық',patch:'Таңдалған өрістерді түзету',save:'Сақтау',publish:'Жариялау',unpublish:'Жариялауды уақытша өшіру',readback:'Сақталғанын тексеру'};
  class Runner {
    constructor({adapter,state,persist,onChange=()=>{}}){this.adapter=adapter;this.state=state;this.persist=persist;this.onChange=onChange;this.stopping=false;this.running=false;}
    async update(job,patch){this.state.jobs[job.id]={...this.state.jobs[job.id],...patch,revision:job.revision,updatedAt:new Date().toISOString()};await this.persist();this.onChange();}
    async action(job,name,payload={}){
      if(this.stopping&&!this.finishingLesson)throw Error('Кезек тоқтатылды.');
      await this.update(job,{step:name,detail:labels[name]||name,inFlight:mutations.has(name)?name:null});
      let result;
      try{result=await this.adapter.call(name==='openCreate'?'open':name,{...job.task,...payload,jobId:job.id});}
      catch(e){if(e?.safe)await this.update(job,{inFlight:null});throw e;}
      await this.update(job,{inFlight:null,...(result?.lessonUrl?{lessonUrl:result.lessonUrl}:{}),...(result?.link?{link:result.link}:{})});return result;
    }
    async inspect(job){
      let record=this.state.jobs[job.id];
      if(record?.inFlight||record?.uncertain)throw Error('Алдыңғы әрекет нәтижесі белгісіз. Алдымен ашық бетті тексеріңіз.');
      // A lesson found for an older version of the plan (another month, №, teacher or time) is not this lesson.
      // Reusing its address would fill the wrong lesson, so everything learned for the old plan is dropped.
      if(record&&record.revision!==job.revision){this.state.jobs[job.id]={skip:record.skip};record=null;}
      await this.update(job,{phase:'running',error:null});
      await this.adapter.navigate(record?.lessonUrl||job.course.url);
      const opened=record?.lessonUrl?{exists:true}:await this.action(job,'open',{allowCreate:false});
      if(!opened.exists&&opened.missing==='week'){
        const message=`«${job.task.month}-АЙ ${job.task.week}-АПТА» аптасында сайтта бірде-бір тақырып жоқ. Ай мен апта дұрыс па? Кестедегі «Оқу айы», «Апта» және «LIVE №» мәндерін тексеріңіз; бұл сабақ орындалмайды.`;
        await this.update(job,{phase:'error',error:message,detail:message,baseline:null,differences:[],selected:[]});return;}
      if(!opened.exists){
        const what=opened.missing==='theme'?`бұл аптада «${job.task.theme}» тақырыбы әлі жоқ, ол да құрылады`:opened.missing==='lesson'?`«${job.task.theme}» тақырыбында бұл сабақ әлі жоқ`:'сайтта бұл сабақ әлі жоқ';
        const seen=opened.seen?.length?`. Сайтта бар ұқсас атаулар: ${opened.seen.join(' · ')}`:'';
        await this.update(job,{phase:'new',baseline:null,differences:[],selected:[],missing:opened.missing||null,seen:opened.seen||[],detail:`Жаңа сабақ ашылады: ${what}${seen}`});return;}
      const actual=await this.action(job,'snapshot');
      const differences=M.diff(job.task,actual);
      if(!M.validLink(actual.link))differences.push({key:'link',label:'Meet сілтемесі',before:actual.link,after:'Жаңа Meet қажет',editable:false});
      // A lesson that was created but never got its Meet (and is not published) is finished like a new one.
      const incomplete=!M.validLink(actual.link)&&!actual.published;
      const phase=incomplete?'incomplete':differences.length?'review':actual.published?'done':'ready';
      const details={incomplete:'Сабақ бар, бірақ Meet құрылмаған. Орындағанда Meet құрылып, өрістер толтырылып, сабақ жарияланады',review:'Айырмашылықтарды таңдаңыз',done:'Жарияланған, сәйкес',ready:'Жариялауға дайын'};
      await this.update(job,{phase,baseline:actual,differences,selected:[],detail:details[phase],link:actual.link,lessonUrl:actual.lessonUrl,record:phase==='done'?this.record(job,actual):null});
    }
    record(job,actual){return {task:{...job.task,...Object.fromEntries(['date','start','end'].map(k=>[k,actual[k]]))},course:job.course,published:actual.published,verified:true,link:actual.link,lessonUrl:actual.lessonUrl,verifiedAt:new Date().toISOString()};}
    source(job){const inherited=['studentTitle','date','start','end','deadline','deadlineTime','attendance','percent','email'];return Object.values(this.state.jobs).filter(s=>!s.differences?.some(d=>inherited.includes(d.key))).map(s=>s.record).find(r=>r?.published&&r.verified&&r.task.id===job.rowId&&r.course.id!==job.course.id&&r.task.date===job.task.date&&r.task.start===job.task.start&&r.task.end===job.task.end&&M.validLink(r.link));}
    async readback(job,link){await this.update(job,{step:'readback',detail:labels.readback});await this.adapter.navigate(this.state.jobs[job.id].lessonUrl,{reload:true});const actual=await this.action(job,'snapshot',{connectionLink:link});if(actual.link!==link)throw Error('Қайта ашылған сабақтың Meet сілтемесі сәйкес емес.');return actual;}
    async execute(job){
      let status=this.state.jobs[job.id];
      if(!status||status.revision!==job.revision)throw Error('Жоспар өзгерді. Алдымен қайта тексеріңіз.');
      if(status.uncertain||status.inFlight)throw Error('Алдыңғы әрекет нәтижесін ашық беттен тексеріңіз.');
      if(status.phase==='done'||status.skip)return;
      if(!['new','incomplete','ready','review','resume'].includes(status.phase))return;
      if(status.phase==='review'&&!status.selected?.length)return;
      const previousPhase=status.phase,selected=[...(status.selected||[])],baseline=status.baseline;
      this.finishingLesson=true;
      await this.update(job,{phase:'running',error:null});
      const source=this.source(job);
      if(job.course.id!==job.sourceCourseId&&!source&&['new','incomplete'].includes(previousPhase))throw Error('Бастапқы курс аяқталмаған. Ортақ Meet расталмайынша жаңа сілтеме құрылмайды.');
      if(previousPhase!=='resume')await this.adapter.navigate(status.lessonUrl||job.course.url);
      if(!status.lessonUrl){await this.action(job,previousPhase==='new'?'openCreate':'open',{allowCreate:previousPhase==='new'});}
      let actual=await this.action(job,'snapshot');
      if(['new','incomplete'].includes(previousPhase)&&actual.published){await this.update(job,{phase:'review',baseline:actual,differences:M.diff(job.task,actual),selected:[],detail:'Сабақ басқа жерден жарияланған. Қайта тексеріңіз.'});return;}
      const expectedLink=source?.link;
      if(actual.link&&expectedLink&&actual.link!==expectedLink)throw Error('Байланысатын курстарда әртүрлі Meet бар. Қолмен тексеріңіз.');
      let link=actual.link;
      const newFlow=['new','incomplete','resume'].includes(previousPhase);
      if(newFlow){
        if(!link){const result=await this.action(job,source?'attach':'createMeet',source?{reuse:{...source,published:true,courseName:source.course.name}}:{});link=result.link;}
        await this.action(job,'fillNotes',{connectionLink:link});
        await this.action(job,'save',{connectionLink:link});
        actual=await this.readback(job,link);
        const remaining=M.diff(job.task,actual);if(remaining.length)throw Error('Сақталған өрістер сәйкес емес: '+remaining.map(d=>d.label).join(', '));
      }else if(selected.length){
        for(const key of selected){if(!baseline||M.clean(actual[key])!==M.clean(baseline[key]))throw Error('Сабақ тексеруден кейін өзгерген: '+M.fieldLabels[key]);if(actual.editable?.[key]===false)throw Error('Бұл өріс бастапқы кездесуде түзетіледі: '+M.fieldLabels[key]);}
        if(actual.published){await this.action(job,'unpublish',{approvedUnpublish:true});await this.update(job,{mustRepublish:true});}
        await this.action(job,'patch',{changes:selected,baseline:actual,connectionLink:link});
        await this.action(job,'save',{connectionLink:link});actual=await this.readback(job,link);
        const remaining=M.diff(job.task,actual).filter(d=>selected.includes(d.key));if(remaining.length)throw Error('Таңдалған өрістер сақталмады: '+remaining.map(d=>d.label).join(', '));
      }
      if(!M.validLink(link))throw Error('Meet сілтемесі жоқ.');
      await this.action(job,'publish',{connectionLink:link});
      actual=await this.readback(job,link);if(!actual.published)throw Error('Жариялануы расталмады.');
      const differences=M.diff(job.task,actual);
      await this.update(job,{phase:differences.length?'review':'done',differences,selected:[],baseline:actual,record:this.record(job,actual),mustRepublish:false,detail:differences.length?`Таңдалғаны түзетілді; ${differences.length} айырмашылық қалды`:'Сақталды және жарияланды'});
    }
    async recover(job){
      const status=this.state.jobs[job.id];
      if(!status?.uncertain&&!status?.inFlight)throw Error('Тексерілетін үзілген қадам жоқ.');
      // Do not navigate away from an unsaved form after an uncertain create/save.
      const actual=await this.adapter.call('snapshot',{...job.task,jobId:job.id,connectionLink:status.link});
      if(status.lessonUrl&&new URL(actual.lessonUrl).pathname!==new URL(status.lessonUrl).pathname)throw Error('Үзілген сабақтың бетін ашыңыз.');
      if(!M.validLink(actual.link))throw Error('Meet нәтижесі әлі анықталмады. Құру қайта басылмады; сайттан тексеріңіз.');
      if(actual.published){const differences=M.diff(job.task,actual);await this.update(job,{phase:differences.length?'review':'done',uncertain:false,inFlight:null,record:differences.length?null:this.record(job,actual),baseline:actual,differences,selected:[],detail:'Жарияланған сабақ тексерілді'});return;}
      await this.update(job,{phase:'resume',uncertain:false,inFlight:null,baseline:actual,link:actual.link,lessonUrl:actual.lessonUrl,detail:'Meet табылды. Сақтау мен жариялаудан жалғасады'});
    }
    // The person has checked the lesson on the site by hand. The job leaves the blocked state and must be scanned
    // again before anything is executed, so the next decision is based on what the site really contains.
    async release(job){
      const status=this.state.jobs[job.id];
      if(!status?.uncertain&&!status?.inFlight)throw Error('Тексерілетін үзілген қадам жоқ.');
      if(this.running)throw Error('Кезек орындалып жатыр.');
      await this.update(job,{phase:'error',uncertain:false,inFlight:null,error:null,selected:[],detail:'Қолмен тексерілді. Орындаудан бұрын қайта тексеріңіз.'});
    }
    async run(jobs,mode){
      if(this.running)throw Error('Кезек орындалып жатыр.');this.running=true;this.stopping=false;this.state.active=true;await this.persist();this.onChange();
      try{for(const job of jobs){if(this.stopping)break;this.finishingLesson=false;try{await (mode==='scan'?this.inspect(job):this.execute(job));}
        catch(e){const s=this.state.jobs[job.id];const uncertain=!!(s?.inFlight||s?.uncertain);await this.update(job,{phase:uncertain?'uncertain':'error',uncertain,error:e.message,detail:e.message});if(uncertain||mode!=='scan'||s?.mustRepublish)break;}}
      }finally{this.finishingLesson=false;this.running=false;this.state.active=false;await this.persist();this.onChange();}
    }
    stop(){this.stopping=true;}
  }
  const api={Runner,labels,mutations};if(typeof module!=='undefined')module.exports=api;else root.LiveRunner=api;
})(globalThis);

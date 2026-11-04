/* Course URLs verified through the JUZ40 course list on 2026-10-14. */
(function(root){
  const subjectIds={math:'11c81c50-c914-4030-8083-e5d4bfe6e6d0',ms:'e6d6f884-5f5a-46c0-9b5a-929051b9a3d8',physics:'0b14d605-8adb-436d-8953-e2472d4ff048',chemistry:'24beb7d0-dc5f-4e2e-a66c-c44b51af9e67',info:'6e172165-57c2-4b01-9fd1-70ccca7b96a7'};
  const rows={
    math:[
      ['oct','ФИЗ-МАТ','08c76325-54fd-4c33-b4b4-aa68ac49059e'],
      ['oct','ИНФО-МАТ','1a2fcc66-e4e1-491e-93b6-60644c8593b0'],
      ['oct','ГЕО-МАТ','8adcd2c9-30a9-4992-b310-f18b9da6ed08'],
      ['sep','ИНФО-МАТ','03766a29-b3b9-42de-9920-2e7edc8da478'],
      ['sep','ФИЗ-МАТ','12c02325-dc5d-4269-a266-6b0bd47cc8d1'],
      ['sep','ГЕО-МАТ','6550337c-199b-42b1-a84a-2c13c66ca0e3'],
      ['aug','ИНФО-МАТ','1faaecb7-3bba-40fe-a4e0-e8339fe2908a'],
      ['aug','ФИЗ-МАТ','9d22ebf0-1668-4c43-b3d9-aee0a4516392'],
      ['aug','ГЕО-МАТ','c4781325-7c51-40a7-8ed9-3658ce2141ce']
    ],
    ms:[
      ['oct','ДЖТ-АНГЛ IELTS','01117f50-bb30-43c9-8965-bf544a0aca27'],
      ['oct','БИО-ХИМ','0228804b-b16a-46a3-bbd4-83ccfe058c99'],
      ['oct','ИНФО-МАТ','35961355-a45c-4158-b94f-58ddf0ad4164'],
      ['oct','РУС-ЛИТ','5a4004fa-ad29-42d8-a230-c03a7f22245b'],
      ['oct','ӘДЕБ-ТІЛ','98c82afc-36c2-44d5-83be-28fb41a5cbb6'],
      ['oct','ГЕО-АНГЛ IELTS','a1080aad-d72c-4b53-80ba-ce8fd1f5a2f8'],
      ['oct','ГЕО-БИО','a90852c7-3634-4624-8fcb-86c5ad8a66dd'],
      ['oct','ГЕО-МАТ','b2406090-caee-46e9-b98c-0dde1fe11ce9'],
      ['oct','ДЖТ-АНГЛ TOEFL','c0d7e338-c1d8-4e3b-9edc-da407e285102'],
      ['oct','ФИЗ-МАТ','cf3e3277-904d-45e7-9c59-fb6be5a1b77b'],
      ['oct','ГЕО-ДЖТ','df67af95-8c36-4d98-ad9d-62bf55db0cf9'],
      ['oct','ФИЗ-ХИМ','e0611a67-3adf-451d-9567-df31b27111e4'],
      ['oct','ДЖТ-ҚҰҚЫҚ','e6df21ef-00ee-4e60-bdde-0ab4a2c52c64'],
      ['sep','ФИЗ-ХИМ','0a518e41-71b0-4a05-a125-a35c1aaf9247'],
      ['sep','ГЕО-МАТ','0b42511f-48d7-43d0-a56a-d7fdab6cb03a'],
      ['sep','ДЖТ-АНГЛ IELTS','28e84491-47ae-451c-8471-731119c9d075'],
      ['sep','ИНФО-МАТ','3e60390a-8308-4b5f-a73f-f25a8fe9d391'],
      ['sep','ӘДЕБ-ТІЛ','46410170-74d0-4b00-ac88-3d7d87a56afd'],
      ['sep','РУС-ЛИТ','46bfd13f-d622-4797-bb93-126f4aad055e'],
      ['sep','ГЕО-ДЖТ','622b7257-da98-48af-804c-62da1b98a6e8'],
      ['sep','ГЕО-АНГЛ IELTS','63ce5a53-2861-407d-b74d-d2da426d1d74'],
      ['sep','ГЕО-БИО','713a6113-8c19-457b-90ca-4c53f3cb6100'],
      ['sep','ДЖТ-АНГЛ TOEFL','9829c526-64a7-40c1-9e6c-3e1ed7088a3c'],
      ['sep','ФИЗ-МАТ','9ad10780-7941-4217-93bd-d8d3f4d0dbdd'],
      ['sep','БИО-ХИМ','a4bd6a3a-267d-48da-a4ca-d3a3dfd97dfc'],
      ['sep','ДЖТ-ҚҰҚЫҚ','a914d7f5-05f5-4b97-a9cb-143689d214f4'],
      ['sep','ГЕО-АНГЛ','cefbe8da-e20c-482d-9347-d450d61c7f9a'],
      ['aug','ГЕО-МАТ','0c675760-db3b-4523-8259-d32bac7834b2','combo'],
      ['aug','РУС-ЛИТ','1fbe4ed7-a3ea-4427-a4e2-124b2742e495'],
      ['aug','ӘДЕБ-ТІЛ','4cb76a2c-1d88-4e7f-a604-b51a8e5bfe39'],
      ['aug','ФИЗ-МАТ','719063f5-b9bc-4bc6-8a0c-d8c00f9633eb','combo'],
      ['aug','ГЕО-ДЖТ','75bb94bb-73ac-4dfc-ae43-7014a253feeb'],
      ['aug','ФИЗ-ХИМ','7a72b354-5a22-4e4d-b54e-94160b5dcd4c'],
      ['aug','ДЖТ-АНГЛ IELTS','8d192d64-32ad-46a2-a9ba-8b6b5f9491ed'],
      ['aug','ГЕО-БИО','be865e89-632f-4aec-a822-2e21d209d744'],
      ['aug','ГЕО-АНГЛ IELTS','c04409f1-041a-4783-8f2c-6431c4f6dbf8'],
      ['aug','ДЖТ-АНГЛ TOEFL','c3cbfd73-acbf-4be7-ba03-c559983f6aaa'],
      ['aug','ИНФО-МАТ','ced9fac0-a1b2-498c-9204-a491de993216','combo'],
      ['aug','ГЕО-АНГЛ','dde5bd76-331d-447b-9952-5cdfcdd82088'],
      ['aug','ДЖТ-ҚҰҚЫҚ','deeadc4e-5dd4-4546-a79c-1834ae8ae311'],
      ['aug','БИО-ХИМ','ee0a3bb8-2bf7-48d2-9240-dc9d646233aa']
    ],
    physics:[
      ['oct','ФИЗ-ХИМ','49ef8187-025c-4ad5-ae0c-b54c47c17235'],
      ['oct','ФИЗ-МАТ','ddecaa82-9d55-44d6-94ab-dd0b5f837b3c'],
      ['sep','ФИЗ-ХИМ','ae4f5774-9438-4d16-b13d-b1e18b2f7808'],
      ['sep','ФИЗ-МАТ','fbe93e93-524b-4fbc-922e-0e6d62c37c8a'],
      ['aug','ФИЗ-МАТ','7d1f0c04-0a70-4dda-9913-ed7371718984'],
      ['aug','ФИЗ-ХИМ','878ff622-19c7-4f95-8430-c71f3aa31ec0']
    ],
    chemistry:[
      ['oct','ФИЗ-ХИМ','46085ed9-878f-4f22-a71e-9f1e39d3ca1c'],
      ['oct','БИО-ХИМ','fdfdca25-a59f-4885-b1ca-2bc335dfa682'],
      ['sep','ФИЗ-ХИМ','056814fa-3890-4254-b81e-779938ebfc93'],
      ['sep','БИО-ХИМ','20af3b5f-6f92-4dda-a6b3-4e62267e3ff1'],
      ['aug','ФИЗ-ХИМ','b0231195-e6ea-4166-b027-ad601cd1efa0'],
      ['aug','БИО-ХИМ','ff382b96-6b90-4964-aabf-0acacd340dee']
    ],
    info:[
      ['oct','ИНФО-МАТ','4c6c3c35-4c9b-49bd-9f4f-c884f204bc3d'],
      ['sep','ИНФО-МАТ','f8236b74-9a90-452f-b415-f3101ddbef5d'],
      ['aug','ИНФО-МАТ','93daca7b-8700-4040-8411-44317a28d3fc']
    ]
  };
  const months={aug:'ТАМЫЗ',sep:'ҚЫРКҮЙЕК',oct:'ҚАЗАН'},codes={math:'МАТ',ms:'МС',physics:'ФИЗ',chemistry:'ХИМ',info:'ИНФО'};
  const courses=Object.entries(rows).flatMap(([subject,list])=>list.map(([stream,direction,id,type])=>({subject,stream,direction,id,subjects:type==='combo'?['ms','geometry']:[subject],name:`SMART-PRO | ${direction} | ${type==='combo'?'МС+ГЕОМ':codes[subject]} | ${months[stream]}`,url:`https://juz40-edu.kz/headTeacher/subjects/${subjectIds[subject]}/${id}`})));
  function buildBindings(D){return Object.fromEntries(D.schedule.map(slot=>[slot.id,courses.filter(c=>c.stream===slot.stream&&c.subjects.includes(slot.subject)).filter(c=>{try{D.checkScope(slot,c.name);return true;}catch{return false;}}).map(c=>({name:c.name,url:c.url}))]));}
  function unmatched(D){const used=new Set(Object.values(buildBindings(D)).flat().map(b=>b.url));return courses.filter(c=>!used.has(c.url));}
  // 1.3.0: courses read from the JUZ40 account (extension → apiCourses). Names follow «SMART-PRO | бағыт | код | ай»;
  // the code gives the subject (model.js codes), the month gives the stream (settings stream name). A course that would
  // be a second one for the same stream + direction + subject is not added: a row would then fill two lessons.
  function fromJuz(items,settings,catalog,M){
    const added=[],skipped=[],unknown=[];
    const key=(stream,direction,subject)=>stream+'|'+M.direction(direction)+'|'+subject;
    const taken=new Map();for(const c of catalog)for(const s of c.subjects)taken.set(key(c.stream,c.direction,s),c);
    const known=new Set(catalog.map(c=>c.id));
    const byCode=Object.fromEntries(Object.entries(M.codes).map(([k,v])=>[v,k]));
    for(const item of items){
      if(!item?.id||known.has(item.id))continue;
      const parts=String(item.name||'').split('|').map(M.clean);
      if(parts.length!==4||!/^SMART[- ]?PRO$/i.test(parts[0])){unknown.push(item.name);continue;}
      const [,direction,code,month]=parts,c=M.norm(code).replace(/\s/g,'');
      const subjects=c==='МС+ГЕОМ'?['ms','geometry']:byCode[c]?[byCode[c]]:[];
      const stream=settings.streams.find(s=>M.norm(s.name)===M.norm(month));
      if(!subjects.length||!stream||!M.courseId(item.url)){unknown.push(item.name);continue;}
      const clash=subjects.map(s=>taken.get(key(stream.id,direction,s))).find(Boolean);
      if(clash){skipped.push({name:item.name,clash:clash.name});continue;}
      const course={subject:subjects[0],stream:stream.id,direction,id:item.id,subjects,name:item.name,url:item.url};
      for(const s of subjects)taken.set(key(stream.id,direction,s),course);
      added.push(course);known.add(item.id);
    }
    return {added,skipped,unknown};
  }
  const api={courses,buildBindings,unmatched,fromJuz};if(typeof module!=='undefined')module.exports=api;else root.LiveCourses=api;
})(typeof globalThis!=='undefined'?globalThis:this);

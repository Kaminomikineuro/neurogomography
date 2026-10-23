import base64, json, math, pathlib, struct, wave

root = pathlib.Path(__file__).resolve().parents[2]
out = root / 'studio/export/s01e01'
out.mkdir(parents=True, exist_ok=True)
ep = json.loads((root/'studio/data/episodes/s01e01.json').read_text(encoding='utf-8'))
clips=[]
for scene in ep['scenes']:
    for shot in scene['shots']:
        videos=shot.get('videos',[])
        selected=shot.get('videoSelected')
        if shot.get('cut') or selected is None or selected >= len(videos): continue
        source=root/videos[selected]['file']
        if not source.is_file(): continue
        clips.append(dict(id=shot['id'], dur=shot.get('dur',4), dialogue=bool(shot.get('lines')), src='data:video/mp4;base64,'+base64.b64encode(source.read_bytes()).decode()))

# Original quiet minor-key cue: slow bowed harmonics and a sparse bell motif.
sr=22050
length=100
chords=[(146.832,174.614,220),(130.813,174.614,207.652),(116.541,146.832,174.614),(130.813,164.814,220)]
buf=bytearray()
for i in range(sr*length):
    t=i/sr
    bar=int(t/8)
    pos=t%8
    chord=chords[bar%4]
    env=min(1,pos/1.5)*min(1,(8-pos)/2)
    v=sum((math.sin(2*math.pi*f*t)+.22*math.sin(2*math.pi*2*f*t)) for f in chord)*.037*env
    v+=.025*math.sin(2*math.pi*chord[0]/2*t)
    beat=t%2
    note=[293.665,349.228,440,391.995,349.228,293.665,261.626,220][int(t/2)%8]
    v+=.065*math.exp(-beat*2.5)*(1-math.exp(-beat*40))*(math.sin(2*math.pi*note*t)+.2*math.sin(2*math.pi*note*3*t))
    v*=min(1,t/2)*min(1,(length-t)/3)
    buf.extend(struct.pack('<h',int(max(-1,min(1,v))*32767)))
music=out/'Музыка — тревожный совет.wav'
with wave.open(str(music),'wb') as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr); f.writeframes(buf)
html='''<!doctype html><html lang="ru"><meta charset="utf-8"><title>Белая кровь — монтаж первой серии</title>
<style>body{background:#111015;color:#eee;font:17px system-ui;max-width:1100px;margin:30px auto;padding:0 20px}canvas{width:100%;background:black}button{padding:12px 22px;margin:12px 8px 12px 0;font:inherit;cursor:pointer}small{color:#bbb}</style>
<h1>Белая кровь · Первая серия</h1><p>Эльтарион и военный совет · 11 видеокадров</p>
<canvas width="960" height="540"></canvas><br><button id="play">▶ Смотреть</button><button id="save">Сохранить видео WebM</button><span id="status">Загрузка видео…</span><p><small>Авторская инструментальная подложка. Исходный звук сохранён; музыка тише во время доклада. Без добавленных титров.</small></p>
<script>
const clips=CLIPS, music=new Audio(MUSIC), canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d'), status=document.querySelector('#status');
let ac,dest,musicGain,rec,active=false,raf,clock=0;
const videos=clips.map(c=>{let v=document.createElement('video');v.src=c.src;v.preload='auto';v.playsInline=true;return v});
const ready=Promise.all(videos.map(v=>new Promise((res,rej)=>{v.onloadedmetadata=res;v.onerror=()=>rej(Error('Не удалось прочитать видео'));})));
let starts=[],durations=[],overlaps=[],total=0;
ready.then(()=>{clips.forEach((c,i)=>{durations[i]=c.dialogue?videos[i].duration:Math.min(c.dur,videos[i].duration);overlaps[i]=i<3?.4:0;starts[i]=total;total+=durations[i]-overlaps[i];});status.textContent=`Готово · ${total.toFixed(1)} с`;draw(0);}).catch(e=>status.textContent=e.message);
function setup(){if(ac)return;ac=new AudioContext();dest=ac.createMediaStreamDestination();musicGain=ac.createGain();musicGain.gain.value=.65;ac.createMediaElementSource(music).connect(musicGain);musicGain.connect(ac.destination);musicGain.connect(dest);videos.forEach(v=>{const g=ac.createGain();g.gain.value=.85;ac.createMediaElementSource(v).connect(g);g.connect(ac.destination);g.connect(dest)});}
function paint(v,alpha){ctx.globalAlpha=alpha;const r=Math.max(canvas.width/v.videoWidth,canvas.height/v.videoHeight);ctx.drawImage(v,(canvas.width-v.videoWidth*r)/2,(canvas.height-v.videoHeight*r)/2,v.videoWidth*r,v.videoHeight*r);ctx.globalAlpha=1;}
function draw(t){ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);let k=0;starts.forEach((s,i)=>{if(t>=s)k=i});if(k>0&&t<starts[k]+overlaps[k-1]){paint(videos[k-1],1);paint(videos[k],(t-starts[k])/overlaps[k-1]);}else paint(videos[k],1);let fade=Math.min(1,t/.65,(total-t)/1.3);if(k===3)fade*=Math.min(1,(starts[4]-t)/.25);if(k===4)fade*=Math.min(1,(t-starts[4])/.25);ctx.globalAlpha=1-Math.max(0,fade);ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);ctx.globalAlpha=1;}
async function run(save){if(active)return;await ready;setup();await ac.resume();active=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);videos.forEach(v=>{v.pause();v.currentTime=0});music.currentTime=0;music.play();if(save){const stream=canvas.captureStream(30);dest.stream.getAudioTracks().forEach(t=>stream.addTrack(t));const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:5000000});const chunks=[];rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{const blob=new Blob(chunks,{type:mime});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='Белая кровь — s01e01 — аниме-монтаж.webm';a.click();status.textContent='Видео собрано — файл сохранён браузером';};rec.start(500);}
clock=performance.now();const started=new Set();function tick(){const t=(performance.now()-clock)/1000;if(t>=total){finish();return}videos.forEach((v,i)=>{if(t>=starts[i]&&t<starts[i]+durations[i]){if(!started.has(i)){started.add(i);v.play().catch(()=>{});}}else if(started.has(i))v.pause();});draw(t);const speaking=clips.some((c,i)=>c.dialogue&&t>=starts[i]-.3&&t<starts[i]+durations[i]+.2);musicGain.gain.setTargetAtTime((speaking?.20:.65)*Math.min(1,(total-t)/2),ac.currentTime,.15);status.textContent=`${t.toFixed(1)} / ${total.toFixed(1)} с`;raf=requestAnimationFrame(tick)}tick();}
function finish(){cancelAnimationFrame(raf);videos.forEach(v=>v.pause());music.pause();ctx.fillStyle='#000';ctx.fillRect(0,0,960,540);if(rec&&rec.state==='recording')rec.stop();else status.textContent='Просмотр завершён';active=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
document.querySelector('#play').onclick=()=>run(false).catch(e=>{status.textContent=e.message;active=false});document.querySelector('#save').onclick=()=>run(true).catch(e=>{status.textContent=e.message;active=false});
</script></html>'''
html=html.replace('CLIPS',json.dumps(clips,ensure_ascii=False)).replace('MUSIC',json.dumps('data:audio/wav;base64,'+base64.b64encode(music.read_bytes()).decode()))
target=out/'Белая кровь — монтаж.html'
target.write_text(html,encoding='utf-8')
(out/'Монтажный лист.json').write_text(json.dumps({'episode':'s01e01','status':'playable_browser_cut','clips':[{k:v for k,v in c.items() if k!='src'} for c in clips],'music':music.name,'note':'Воспроизведение и экспорт в отдельном HTML. Вкладка студии не изменена. Длительность реплик сохраняется по исходным видео.'},ensure_ascii=False,indent=2),encoding='utf-8')
print(target)
print('Clips:',len(clips),'HTML bytes:',target.stat().st_size)

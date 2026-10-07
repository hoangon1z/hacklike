import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bold, Italic, Heading2, List, ListOrdered, Link, ImagePlus, Quote, Eye, Pencil, Plus } from 'lucide-react';
import { api } from './api';
import { AnnouncementContent } from './AnnouncementContent';

type Post = { id:string; title:string; content:string; kind:string; published:boolean; createdAt:string };
export function AnnouncementEditor() {
  const [posts,setPosts]=useState<Post[]>([]);
  const [id,setId]=useState(''),[title,setTitle]=useState(''),[content,setContent]=useState(''),[kind,setKind]=useState('NEWS'),[published,setPublished]=useState(false);
  const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[preview,setPreview]=useState(false),[loading,setLoading]=useState(true);
  const editor=useRef<HTMLTextAreaElement>(null),fileInput=useRef<HTMLInputElement>(null);
  const selection=useRef({start:0,end:0});
  const dirty = !!(id || title || content);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
  const load=()=>api<Post[]>('/admin/announcements').then(setPosts);
  useEffect(()=>{load().catch(()=>setMessage('Chưa thể tải danh sách bài đăng.')).finally(()=>setLoading(false));},[]);
  function reset(){setId('');setTitle('');setContent('');setKind('NEWS');setPublished(false);setPreview(false);selection.current={start:0,end:0};}
  function insert(prefix:string,suffix='',placeholder='Nội dung') {
    const {start,end}=selection.current;
    const value=prefix+(content.slice(start,end)||placeholder)+suffix;
    setContent(previous=>previous.slice(0,start)+value+previous.slice(end));
    selection.current={start:start+value.length,end:start+value.length};
    setPreview(false);
    window.requestAnimationFrame(()=>{editor.current?.focus();editor.current?.setSelectionRange(start+prefix.length,start+value.length-suffix.length);});
  }
  async function upload(file?:File){
    if(!file)return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setMessage('Chọn ảnh JPG, PNG hoặc WebP không quá 5 MB.');return;}
    setUploading(true);setMessage('');
    try{const form=new FormData();form.append('image',file);const response=await fetch('/api/admin/announcements/images',{method:'POST',credentials:'include',body:form});const result=await response.json();if(!response.ok||!result.success)throw new Error();insert('\n\n![Ảnh bài đăng]('+result.data.url+')\n\n','','');setMessage('Đã tải ảnh lên và chèn vào bài viết.');}
    catch{setMessage('Chưa thể tải ảnh. Kiểm tra định dạng, dung lượng và thử lại.');}
    finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
  }
  async function save(event:FormEvent){event.preventDefault();if(content.length>20000||!content.trim())return;setBusy(true);setMessage('');try{await api(`/admin/announcements${id?'/'+id:''}`,{method:id?'PATCH':'POST',body:JSON.stringify({title:title.trim(),content,kind,published})});reset();setMessage('Đã lưu bài đăng.');await load();}catch{setMessage('Chưa thể lưu bài đăng. Nội dung vẫn được giữ để bạn thử lại.');}finally{setBusy(false);}}
  const disabled=busy||uploading;
  const actions=[{label:'Chữ đậm',Icon:Bold,before:'**',after:'**'},{label:'Chữ nghiêng',Icon:Italic,before:'*',after:'*'},{label:'Tiêu đề',Icon:Heading2,before:'\n## ',after:'\n'},{label:'Danh sách',Icon:List,before:'\n- ',after:'\n'},{label:'Danh sách đánh số',Icon:ListOrdered,before:'\n1. ',after:'\n'},{label:'Trích dẫn',Icon:Quote,before:'\n> ',after:'\n'},{label:'Liên kết',Icon:Link,before:'[',after:'](https://)'}];
  return <div className="page announcement-admin"><div className="page-head"><div><h1>Bảng tin & khuyến mãi</h1><p>Soạn bài viết, thêm ảnh và xem trước giao diện trên trang chủ.</p></div></div>
    {message&&<div className="notice" role="status">{message}</div>}
    <div className="announcement-editor-layout"><form className="card announcement-composer" onSubmit={save}>
      <h2>{id?'Chỉnh sửa bài đăng':'Tạo bài đăng mới'}</h2>
      <label htmlFor="announcement-title">Tiêu đề bài đăng</label><input id="announcement-title" className="input" required maxLength={160} value={title} disabled={disabled} onChange={e=>setTitle(e.target.value)}/>
      <label htmlFor="announcement-kind">Loại bài đăng</label><select id="announcement-kind" className="input" value={kind} disabled={disabled} onChange={e=>setKind(e.target.value)}><option value="NEWS">Bảng tin</option><option value="NOTICE">Thông báo</option><option value="PROMOTION">Khuyến mãi</option></select>
      <div className="announcement-mode"><button type="button" aria-pressed={!preview} onClick={()=>setPreview(false)}><Pencil size={16}/>Soạn nội dung</button><button type="button" aria-pressed={preview} onClick={()=>setPreview(true)}><Eye size={16}/>Xem trước</button></div>
      {!preview&&<div className="announcement-toolbar" role="toolbar" aria-label="Định dạng bài viết">{actions.map(({label,Icon,before,after})=><button key={label} type="button" disabled={disabled} title={label} aria-label={label} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(before,after)}><Icon size={18}/></button>)}<button type="button" disabled={disabled} onClick={()=>fileInput.current?.click()}><ImagePlus size={18}/>{uploading?'Đang tải…':'Thêm ảnh'}</button><input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e=>void upload(e.target.files?.[0])}/></div>}
      {preview?<section className="announcement-preview"><h2>{title||'Xem trước bài viết'}</h2>{content?<AnnouncementContent content={content}/>:<p>Chưa có nội dung để xem trước.</p>}</section>:<><label className="sr-only" htmlFor="announcement-body">Nội dung bài viết</label><textarea ref={editor} id="announcement-body" className="input announcement-textarea" value={content} disabled={disabled} onSelect={e=>{selection.current={start:e.currentTarget.selectionStart,end:e.currentTarget.selectionEnd};}} onChange={e=>{setContent(e.target.value);selection.current={start:e.target.selectionStart,end:e.target.selectionEnd};}} placeholder="Viết nội dung hoặc bôi đen đoạn văn và chọn định dạng trên thanh công cụ…"/></>}
      <div className="announcement-hint"><span>JPG / PNG / WebP · tối đa 5 MB/ảnh</span><span>{content.length.toLocaleString('vi-VN')} / 20.000 ký tự</span></div>
      {content.length>20000&&<p className="form-error">Nội dung vượt quá 20.000 ký tự.</p>}
      <label className="announcement-publish"><input type="checkbox" checked={published} disabled={disabled} onChange={e=>setPublished(e.target.checked)}/><span><b>Xuất bản trên trang chủ</b><small>Tắt để lưu bản nháp, chỉ quản trị viên nhìn thấy.</small></span></label>
      <div className="customer-actions"><button className="primary" disabled={disabled||!content.trim()||content.length>20000}>{busy?'Đang lưu…':published?'Lưu & xuất bản':'Lưu bản nháp'}</button><button type="button" className="secondary" disabled={disabled} onClick={()=>{if(!dirty||window.confirm('Bỏ nội dung đang soạn và tạo bài mới?'))reset();}}><Plus size={16}/>Bài mới</button></div>
    </form><section className="card announcement-list"><h2>Bài đã tạo <small>{posts.length}</small></h2>{loading?<p role="status">Đang tải bài đăng…</p>:!posts.length?<p>Chưa có bài đăng.</p>:posts.map(post=><article key={post.id}><span className={post.published?'announcement-live':'announcement-draft'}>{post.published?'Đã xuất bản':'Bản nháp'}</span><h3>{post.title}</h3><time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleString('vi-VN')}</time><button className="secondary" type="button" disabled={disabled} onClick={()=>{if(dirty&&!window.confirm('Bỏ nội dung đang soạn để mở bài này?'))return;setId(post.id);setTitle(post.title);setContent(post.content);setKind(post.kind);setPublished(post.published);setPreview(false);selection.current={start:0,end:0};}}>Chỉnh sửa</button></article>)}</section></div>
  </div>;
}

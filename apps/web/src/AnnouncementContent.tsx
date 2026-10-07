import Markdown from 'react-markdown';
import './announcements.css';

export function AnnouncementContent({ content }: { content: string }) {
  return <div className="announcement-content"><Markdown skipHtml components={{
    a: ({ href, children }) => href && /^https?:\/\//i.test(href) ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>,
    img: ({ src, alt }) => src && /^\/api\/media\/announcements\/[0-9a-f-]{36}$/i.test(src) ? <img src={src} alt={alt || 'Ảnh bài đăng'} loading="lazy" /> : null,
  }}>{content}</Markdown></div>;
}

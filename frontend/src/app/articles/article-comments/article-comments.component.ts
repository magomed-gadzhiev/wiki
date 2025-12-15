import { Component, Input, OnInit, ViewChild, AfterViewInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { QuillModule } from 'ngx-quill';
import { CommentService } from '../../core/services/comment.service';
import { AuthService } from '../../core/services/auth.service';
import { Comment, CommentCreate } from '../../core/models/comment.model';
import { Article } from '../../core/models/article.model';

@Component({
  selector: 'app-article-comments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, QuillModule],
  templateUrl: './article-comments.component.html',
  styleUrls: ['./article-comments.component.scss']
})
export class ArticleCommentsComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() article!: Article;
  @ViewChild('mainEditor') mainEditor: any;
  @ViewChild('replyEditor') replyEditor: any;
  
  comments: Comment[] = [];
  loading = false;
  error: string | null = null;
  commentForm: FormGroup;
  replyForm: FormGroup | null = null;
  replyingTo: Comment | null = null;
  activeEditorType: 'main' | 'reply' | null = null;
  highlightedCommentId: string | null = null;
  private routerSubscription?: Subscription;
  
  quillModules = {
    toolbar: [
      ['bold', 'italic', 'underline', 'strike'],
      ['blockquote', 'code-block'],
      [{ 'header': 1 }, { 'header': 2 }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],
      [{ 'indent': '-1'}, { 'indent': '+1' }],
      [{ 'direction': 'rtl' }],
      [{ 'size': ['small', false, 'large', 'huge'] }],
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['clean'],
      ['link', 'image']
    ]
  };

  constructor(
    private commentService: CommentService,
    private authService: AuthService,
    private fb: FormBuilder,
    private sanitizer: DomSanitizer,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.commentForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  ngOnInit(): void {
    if (this.article && this.article.id) {
      this.loadComments();
    }
    
    // Проверяем, есть ли якорь в URL при загрузке страницы
    setTimeout(() => {
      this.checkUrlAnchor();
    }, 500);
    
    // Подписываемся на изменения навигации (включая изменения хэша)
    this.routerSubscription = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => {
        // Небольшая задержка для того, чтобы DOM обновился
        setTimeout(() => {
          this.checkUrlAnchor();
        }, 100);
      });
    
    // Также слушаем события изменения хэша напрямую
    window.addEventListener('hashchange', () => {
      setTimeout(() => {
        this.checkUrlAnchor();
      }, 100);
    });
  }

  ngAfterViewInit(): void {
    // Quill инициализируется автоматически через ngx-quill
    // Обрабатываем клики по ссылкам на комментарии
    setTimeout(() => {
      this.setupCommentLinks();
      this.checkUrlAnchor();
    }, 100);
  }

  checkUrlAnchor(): void {
    // Проверяем, есть ли якорь комментария в URL
    const hash = window.location.hash;
    if (hash && hash.startsWith('#comment-')) {
      const commentId = hash.replace('#comment-', '');
      this.scrollToComment(commentId);
    }
  }

  ngOnDestroy(): void {
    // Отписываемся от событий роутера
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    // Удаляем обработчик события hashchange
    window.removeEventListener('hashchange', () => {
      this.checkUrlAnchor();
    });
  }

  setupCommentLinks(): void {
    // Находим все ссылки на комментарии и добавляем обработчики
    // Удаляем старые обработчики перед добавлением новых
    document.querySelectorAll('a[data-comment-id]').forEach(link => {
      const newLink = link.cloneNode(true);
      link.parentNode?.replaceChild(newLink, link);
      newLink.addEventListener('click', (e) => {
        e.preventDefault();
        const commentId = (newLink as HTMLElement).getAttribute('data-comment-id');
        if (commentId) {
          // Обновляем URL с якорем через Router
          const currentUrl = this.router.url.split('#')[0];
          this.router.navigate([], { fragment: `comment-${commentId}`, replaceUrl: true });
          // Подсвечиваем комментарий
          this.scrollToComment(commentId);
        }
      });
    });
  }

  scrollToComment(commentId: string): void {
    // Небольшая задержка для обеспечения, что DOM обновлен
    setTimeout(() => {
      const element = document.getElementById(`comment-${commentId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        this.highlightedCommentId = commentId;
        this.cdr.detectChanges(); // Принудительное обновление для применения класса highlighted
        
        setTimeout(() => {
          this.highlightedCommentId = null;
          this.cdr.detectChanges(); // Обновление после снятия подсветки
        }, 2000); // Подсветка на 2 секунды
      }
    }, 100);
  }

  getActiveEditor(): any {
    if (this.activeEditorType === 'main' && this.mainEditor?.quillEditor) {
      return this.mainEditor.quillEditor;
    } else if (this.activeEditorType === 'reply' && this.replyEditor?.quillEditor) {
      return this.replyEditor.quillEditor;
    }
    return null;
  }

  referenceComment(comment: Comment): void {
    const editor = this.getActiveEditor();
    if (!editor) {
      // Если нет активного редактора, открываем форму нового комментария
      this.activeEditorType = 'main';
      setTimeout(() => {
        const mainEd = this.mainEditor?.quillEditor;
        if (mainEd) {
          this.insertCommentReference(mainEd, comment);
          // Фокусируем редактор
          mainEd.focus();
        }
      }, 200);
      return;
    }

    this.insertCommentReference(editor, comment);
  }

  insertCommentReference(editor: any, comment: Comment): void {
    if (!editor) return;
    
    let range = editor.getSelection();
    if (!range) {
      // Если нет выделения, вставляем в конец
      const length = editor.getLength();
      range = { index: length - 1, length: 0 };
    }
    
    const authorName = comment.author.username;
    const linkText = `@${authorName} `;
    // Используем текущий URL с якорем
    const currentUrl = this.router.url.split('#')[0]; // Убираем существующий якорь, если есть
    const linkUrl = `${currentUrl}#comment-${comment.id}`;
    
    // Вставляем ссылку через Quill API
    // Используем formatText для вставки текста со ссылкой
    editor.insertText(range.index, linkText);
    editor.formatText(range.index, linkText.length - 1, 'link', linkUrl);
    // Устанавливаем курсор после ссылки
    editor.setSelection(range.index + linkText.length);
  }

  onEditorFocus(editorType: 'main' | 'reply'): void {
    this.activeEditorType = editorType;
  }

  processCommentContent(content: string): string {
    // Обрабатываем ссылки на комментарии в контенте
    // Заменяем все ссылки на комментарии на ссылки с data-comment-id для обработки кликов
    if (!content) return '';
    
    const currentUrl = this.router.url.split('#')[0]; // Убираем существующий якорь, если есть
    
    return content.replace(
      /<a\s+[^>]*href=["']([^"']*)#comment-([^"']+)["'][^>]*>(.*?)<\/a>/gi,
      (match, urlPart, commentId, linkText) => {
        // Если ссылка уже содержит полный путь, используем его, иначе используем текущий URL
        const fullUrl = urlPart ? `${urlPart}#comment-${commentId}` : `${currentUrl}#comment-${commentId}`;
        return `<a href="${fullUrl}" data-comment-id="${commentId}" class="comment-link">${linkText}</a>`;
      }
    );
  }

  canComment(): boolean {
    if (!this.article || !this.isAuthenticated()) {
      return false;
    }
    // Комментировать можно только опубликованные статьи
    if (!this.article.is_published) {
      return false;
    }
    // Проверяем права доступа (read/edit)
    const user = this.authService.getCurrentUser();
    if (!user) return false;
    
    // Суперпользователи могут комментировать
    if (user.is_staff === true) return true;
    
    // Проверяем права через группы (логика проверки прав на фронтенде упрощена,
    // полная проверка на бэкенде)
    return true; // Права проверяются на бэкенде
  }

  isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  getCurrentUser() {
    return this.authService.getCurrentUser();
  }

  loadComments(): void {
    if (!this.article?.id) return;
    
    this.loading = true;
    this.error = null;
    
    this.commentService.getComments(this.article.id).subscribe({
      next: (comments) => {
        this.comments = comments;
        this.loading = false;
        // После загрузки комментариев настраиваем ссылки
        setTimeout(() => {
          this.setupCommentLinks();
          // Проверяем якорь после загрузки комментариев
          this.checkUrlAnchor();
        }, 100);
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка загрузки комментариев';
        this.loading = false;
      }
    });
  }

  sanitizeHtml(html: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }

  submitComment(): void {
    if (this.commentForm.invalid || !this.article?.id) {
      return;
    }

    const content = this.commentForm.get('content')?.value;
    if (!content || content.trim() === '') {
      return;
    }

    // Извлекаем ID комментариев из ссылок в контенте
    const referencedIds = this.extractReferencedCommentIds(content);

    const commentData: CommentCreate = {
      article_id: this.article.id,
      content: content,
      referenced_comment_ids: referencedIds.length > 0 ? referencedIds : undefined
    };

    this.commentService.createComment(commentData).subscribe({
      next: () => {
        this.commentForm.reset();
        this.activeEditorType = null;
        this.loadComments();
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка создания комментария';
      }
    });
  }

  extractReferencedCommentIds(content: string): string[] {
    const ids: string[] = [];
    const regex = /<a[^>]+href=["']#comment-([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (!ids.includes(match[1])) {
        ids.push(match[1]);
      }
    }
    return ids;
  }

  startReply(comment: Comment): void {
    // Можно отвечать только на комментарии верхнего уровня
    if (comment.parent) {
      return;
    }
    // Закрываем предыдущий редактор, если был открыт
    if (this.replyingTo && this.replyingTo.id !== comment.id) {
      this.cancelReply();
    }
    this.replyingTo = comment;
    this.activeEditorType = 'reply';
    this.replyForm = this.fb.group({
      content: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  cancelReply(): void {
    this.replyingTo = null;
    this.replyForm = null;
    this.activeEditorType = null;
  }

  submitReply(): void {
    if (!this.replyForm || this.replyForm.invalid || !this.replyingTo || !this.article?.id) {
      return;
    }

    const content = this.replyForm.get('content')?.value;
    if (!content || content.trim() === '') {
      return;
    }

    // Извлекаем ID комментариев из ссылок в контенте
    const referencedIds = this.extractReferencedCommentIds(content);

    const commentData: CommentCreate = {
      article_id: this.article.id,
      content: content,
      parent_id: this.replyingTo.id,
      referenced_comment_ids: referencedIds.length > 0 ? referencedIds : undefined
    };

    this.commentService.createComment(commentData).subscribe({
      next: () => {
        this.cancelReply();
        this.loadComments();
      },
      error: (err) => {
        this.error = err.error?.error || 'Ошибка создания ответа';
      }
    });
  }


  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}


import { ArticleService } from '../../core/services/article.service';

export class CkeditorUploadAdapter {
  private loader: any;
  private articleService: ArticleService;
  private articleId: string;

  constructor(loader: any, articleService: ArticleService, articleId: string) {
    this.loader = loader;
    this.articleService = articleService;
    this.articleId = articleId;
  }

  upload(): Promise<any> {
    return this.loader.file
      .then((file: File) => {
        return new Promise((resolve, reject) => {
          this.articleService.uploadImage(this.articleId, file).subscribe({
            next: (response) => {
              resolve({
                default: response.image_url
              });
            },
            error: (error) => {
              reject(error);
            }
          });
        });
      });
  }

  abort(): void {
    // Отмена загрузки не требуется
  }
}


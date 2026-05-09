import { Component, ElementRef, OnInit, viewChild } from '@angular/core';
import { editor } from 'monaco-editor';

@Component({
  selector: 'app-root',
  imports: [],
  template: `
    <div class="bg-green-50 h-screen">
      <h1>Monaco Editor in Angular</h1>
      <div #editor class="h-full w-full border"></div>
    </div>
  `,
  styles: [],
})
export class App implements OnInit {
  private readonly editorContainer = viewChild.required<ElementRef<HTMLDivElement>>('editor');

  ngOnInit(): void {
    editor.create(this.editorContainer().nativeElement, {
      language: 'javascript',
      value: 'console.log("Hello, Monaco Editor!");',
    });
  }
}

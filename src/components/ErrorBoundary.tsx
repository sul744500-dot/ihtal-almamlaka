import { Component, type ReactNode } from 'react';

/** يمنع الشاشة البيضاء: يعرض رسالة مع زر إعادة تحميل (المباراة محفوظة ولن تضيع) */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('خطأ في الواجهة', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">⚠️</div>
        <h1 className="font-display text-2xl font-bold text-gold-100">حدث خطأ غير متوقع في العرض</h1>
        <p className="max-w-md text-slate-300">المباراة محفوظة تلقائيًا ولن تضيع. أعد تحميل الصفحة للمتابعة.</p>
        <pre className="max-w-xl overflow-auto rounded-lg bg-black/40 p-3 text-start text-xs text-red-300" dir="ltr">
          {this.state.error.message}
        </pre>
        <button type="button" className="btn btn-gold" onClick={() => location.reload()}>
          🔄 إعادة التحميل
        </button>
      </div>
    );
  }
}

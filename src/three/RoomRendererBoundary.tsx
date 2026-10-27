"use client";
import { Component, Fragment, type ReactNode } from "react";

/** Rendering can fail independently of the saved design and the 2D editor. */
export class RoomRendererBoundary extends Component<
  { children: ReactNode; onUnavailable?: (unavailable: boolean) => void },
  { failed: boolean; attempt: number }
> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable?.(true); }
  render() {
    if (this.state.failed) return (
      <div role="alert" className="grid h-full place-content-center gap-3 bg-slate-50 p-6 text-center text-sm text-slate-700">
        <p>3D харагдац нээгдсэнгүй.</p>
        <p>Төлөвлөгөө хэвээр байна. 2D горимоор үргэлжлүүлж болно.</p>
        <button type="button" className="mx-auto rounded-xl bg-blue-600 px-5 py-3 text-white" onClick={() => this.setState(state => ({ failed: false, attempt: state.attempt + 1 }))}>
          3D дахин ачаалах
        </button>
      </div>
    );
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}

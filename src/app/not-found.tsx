import Link from "next/link";
import { appPath } from "./app-path";

export default function NotFound() {
  return <div className="empty-state page-empty"><span className="empty-icon">?</span><h1>Not found</h1><p>That part of the catalog is not available.</p><Link href={appPath("/")} className="button button-primary">Back home</Link></div>;
}

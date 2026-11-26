import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

type TableProps = HTMLAttributes<HTMLTableElement> & { caption?: string };

export function Table({ children, className = "", caption = "Data table", ...props }: TableProps) {
  return (
    <div className="table-wrap">
      <table className={`table ${className}`.trim()} {...props}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: ReactNode }) {
  return <thead className="table__head">{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr {...props}>{children}</tr>;
}

export function TableHeader({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <th scope="col" {...props}>{children}</th>;
}

export function TableCell({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td {...props}>{children}</td>;
}

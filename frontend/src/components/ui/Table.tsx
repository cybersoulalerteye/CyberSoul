import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function Table({ children, className = "", ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="table-wrap">
      <table className={`table ${className}`.trim()} {...props}>
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

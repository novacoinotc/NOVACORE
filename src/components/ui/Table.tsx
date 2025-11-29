'use client';

import { cn } from '@/lib/utils';

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export function Table({ className, children, ...props }: TableProps) {
  return (
    <div className="w-full overflow-auto rounded-xl border border-white/5 bg-dark-800">
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      >
        {children}
      </table>
    </div>
  );
}

export function TableHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={cn('bg-dark-700/50', className)} {...props}>
      {children}
    </thead>
  );
}

export function TableBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props}>
      {children}
    </tbody>
  );
}

export function TableRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-b border-white/5 transition-all duration-200 hover:bg-white/[0.02]',
        className
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

export function TableHead({
  className,
  children,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'h-12 px-4 text-left align-middle font-medium text-gray-400 [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    >
      {children}
    </th>
  );
}

export function TableCell({
  className,
  children,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn(
        'p-4 align-middle text-white [&:has([role=checkbox])]:pr-0',
        className
      )}
      {...props}
    >
      {children}
    </td>
  );
}

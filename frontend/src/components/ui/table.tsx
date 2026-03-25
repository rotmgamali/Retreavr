"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-white/10", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn("border-t border-white/10 bg-white/5 font-medium [&>tr]:last:border-b-0", className)}
    {...props}
  />
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-white/10 transition-colors hover:bg-white/5 data-[state=selected]:bg-white/10",
      className
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("p-4 align-middle [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
));
TableCaption.displayName = "TableCaption";

// ─── Sortable Header ─────────────────────────────────────────────────────────

type SortDirection = "asc" | "desc" | null;

interface SortableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSort?: { key: string; direction: SortDirection };
  onSort?: (key: string, direction: SortDirection) => void;
}

const SortableHead = React.forwardRef<HTMLTableCellElement, SortableHeadProps>(
  ({ className, children, sortKey, currentSort, onSort, ...props }, ref) => {
    const isActive = currentSort?.key === sortKey;
    const direction = isActive ? currentSort.direction : null;

    const handleClick = () => {
      if (!onSort) return;
      if (!isActive || direction === null) onSort(sortKey, "asc");
      else if (direction === "asc") onSort(sortKey, "desc");
      else onSort(sortKey, null);
    };

    return (
      <th
        ref={ref}
        className={cn(
          "h-12 px-4 text-left align-middle font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors",
          className
        )}
        onClick={handleClick}
        {...props}
      >
        <div className="flex items-center gap-1">
          {children}
          {isActive && direction === "asc" && <ChevronUp className="h-3.5 w-3.5 text-blue-400" />}
          {isActive && direction === "desc" && <ChevronDown className="h-3.5 w-3.5 text-blue-400" />}
          {(!isActive || direction === null) && (
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
          )}
        </div>
      </th>
    );
  }
);
SortableHead.displayName = "SortableHead";

// ─── Checkbox Cell ────────────────────────────────────────────────────────────

interface CheckboxCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  indeterminate?: boolean;
  asHeader?: boolean;
}

const CheckboxCell = React.forwardRef<HTMLTableCellElement, CheckboxCellProps>(
  ({ checked, onCheckedChange, indeterminate, asHeader, className, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const Tag = asHeader ? "th" : "td";

    React.useEffect(() => {
      if (inputRef.current) {
        inputRef.current.indeterminate = !!indeterminate;
      }
    }, [indeterminate]);

    return (
      <Tag ref={ref as React.Ref<HTMLTableCellElement>} className={cn("pr-0 pl-4 w-10", className)} role="checkbox" {...props}>
        <input
          ref={inputRef}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="h-4 w-4 rounded border border-white/30 bg-white/5 accent-blue-500 cursor-pointer"
        />
      </Tag>
    );
  }
);
CheckboxCell.displayName = "CheckboxCell";

// ─── Pagination ───────────────────────────────────────────────────────────────

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

const TablePagination = ({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: TablePaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = Math.min((page - 1) * pageSize + 1, total);
  const end = Math.min(page * pageSize, total);

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
    .reduce<(number | "...")[]>((acc, p, i, arr) => {
      if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
      acc.push(p);
      return acc;
    }, []);

  return (
    <div className={cn("flex items-center justify-between px-2 py-3", className)}>
      <p className="text-sm text-muted-foreground">
        {total === 0 ? "No results" : `${start}–${end} of ${total}`}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pages.map((item, i) =>
          item === "..." ? (
            <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">
              …
            </span>
          ) : (
            <Button
              key={item}
              variant={item === page ? "default" : "ghost"}
              size="icon"
              onClick={() => onPageChange(item as number)}
              className="h-8 w-8 text-xs"
            >
              {item}
            </Button>
          )
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
  SortableHead,
  CheckboxCell,
  TablePagination,
  type SortDirection,
  type SortableHeadProps,
  type TablePaginationProps,
};

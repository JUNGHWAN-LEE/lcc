// CPU, 메모리 퍼센트를 작은 배지로 표시하는 컴포넌트.
// running 상태인 프로젝트 카드에서 사용.

interface ResourceBadgeProps {
  cpu: number | null;
  mem: number | null;
}

export default function ResourceBadge({ cpu, mem }: ResourceBadgeProps) {
  if (cpu === null && mem === null) return null;

  return (
    <div className="flex gap-1.5 text-xs font-mono">
      {cpu !== null && (
        <span className="bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded">
          CPU {cpu.toFixed(1)}%
        </span>
      )}
      {mem !== null && (
        <span className="bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded">
          MEM {mem.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

import Link from 'next/link';

interface BarCardProps {
  id: string;
  name: string;
  description: string;
}

export default function BarCard({ id, name, description }: BarCardProps) {
  return (
    <Link href={`/bars/${id}`} className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all group">
      <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
        {name}
      </h3>
      {description && (
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">{description}</p>
      )}
    </Link>
  );
}

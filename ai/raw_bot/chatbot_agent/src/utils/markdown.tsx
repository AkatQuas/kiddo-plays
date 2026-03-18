import type { Components } from 'react-markdown';

export const markdownUtils = {
  getRenderComponents: (): Components => ({
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <pre className="bg-gray-100 p-4 rounded-md overflow-auto my-2">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className={`bg-gray-100 px-1 py-0.5 rounded ${className}`} {...props}>
          {children}
        </code>
      );
    },
    table: ({ children }) => (
      <div className="overflow-auto my-2">
        <table className="border-collapse w-full">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-gray-300 px-4 py-2 bg-gray-50">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-300 px-4 py-2">
        {children}
      </td>
    ),
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt || ''}
        className="max-w-full rounded-md my-2"
        loading="lazy"
      />
    ),
  }),
};

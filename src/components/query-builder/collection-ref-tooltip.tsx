import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  QueryType,
  WhereOperator,
  ValueType,
  OrderDirection,
  createDefaultQuery,
} from "./types";
import { useQueryAction } from "./query-action-context";
import { saveQuery as saveQueryToDb } from "@/lib/db";
import clsx from "clsx";

interface CollectionRefTooltipProps {
  className?: string;
  queryPath: string;
  collectionRef: string;
  value: string;
  hideText?: boolean;
}

export function CollectionRefTooltip({
  className,
  queryPath,
  collectionRef,
  value,
  hideText = false,
}: CollectionRefTooltipProps) {
  const { onSaveQuery, onCreateQuery, onExecuteQuery } = useQueryAction();
  const querySegments = queryPath.split("/");
  const parsedCollectionRef = collectionRef
    .split("/")
    .map((item, index) => item.replaceAll("%s", querySegments[index]))
    .join("/");

  const handleCollectionRefClick = async () => {
    try {
      await onSaveQuery();
      const newQuery = {
        ...createDefaultQuery(),
        id: crypto.randomUUID(),
        title: `Query ${parsedCollectionRef} (${value})`,
        source: {
          type: "collection" as QueryType,
          path: parsedCollectionRef,
        },
        constraints: {
          where: {
            enabled: true,
            clauses: [
              {
                field: "__name__",
                operator: "==" as WhereOperator,
                value: value,
                valueType: "string" as ValueType,
              },
            ],
          },
          orderBy: {
            enabled: false,
            field: "",
            direction: "asc" as OrderDirection,
          },
          limit: {
            enabled: false,
            value: null,
          },
        },
        aggregation: {
          count: {
            enabled: false,
          },
          sum: {
            enabled: false,
            fields: [],
          },
          average: {
            enabled: false,
            fields: [],
          },
        },
        updatedAt: Date.now(),
      };

      // Save the new query to the database first
      await saveQueryToDb(newQuery);

      // Then update the UI state
      onCreateQuery(newQuery);
      onExecuteQuery(newQuery);
      toast.success(`Created new query for ${parsedCollectionRef}`);
    } catch (error) {
      console.error("Error handling collection reference click:", error);
      toast.error("Failed to create new query");
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className={clsx(
              "inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline",
              className
            )}
            onClick={handleCollectionRefClick}
            onDoubleClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(value);
              toast.success("Reference ID copied to clipboard");
            }}
          >
            {!hideText && (
              <>{value.length > 5 ? `${value.slice(0, 5)}...` : value}</>
            )}
            <ExternalLink className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] space-y-1 px-2">
          <p className="font-medium">{parsedCollectionRef}</p>
          <p className="text-xs text-gray-300">ID: {value}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

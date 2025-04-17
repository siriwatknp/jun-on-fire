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

interface CollectionRefTooltipProps {
  collectionRef: string;
  value: string;
}

export function CollectionRefTooltip({
  collectionRef,
  value,
}: CollectionRefTooltipProps) {
  const { onSaveQuery, onCreateQuery, onExecuteQuery } = useQueryAction();

  const handleCollectionRefClick = async () => {
    try {
      await onSaveQuery();
      const newQuery = {
        ...createDefaultQuery(),
        id: crypto.randomUUID(),
        title: `Query ${collectionRef} (${value})`,
        source: {
          type: "collection" as QueryType,
          path: collectionRef,
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

      onCreateQuery(newQuery);
      onExecuteQuery(newQuery);
      toast.success(`Created new query for ${collectionRef}`);
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
            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
            onClick={handleCollectionRefClick}
            onDoubleClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(value);
              toast.success("Reference ID copied to clipboard");
            }}
          >
            {value.length > 5 ? `${value.slice(0, 5)}...` : value}
            <ExternalLink className="h-3 w-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[300px] space-y-1 px-2">
          <p className="font-medium">{collectionRef}</p>
          <p className="text-xs text-gray-300">ID: {value}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

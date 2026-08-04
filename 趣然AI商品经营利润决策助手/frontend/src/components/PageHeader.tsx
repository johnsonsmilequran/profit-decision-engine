import { Typography } from "antd";
import type { ReactNode } from "react";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="page-kicker">{kicker}</div>
        <Typography.Title level={2} className="page-title">
          {title}
        </Typography.Title>
        <div className="page-description">{description}</div>
      </div>
      {actions ? <div>{actions}</div> : null}
    </div>
  );
}

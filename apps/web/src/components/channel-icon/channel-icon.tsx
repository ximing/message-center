import { Icon } from "../icon";

export function ChannelIcon({
  provider,
  small = false,
}: {
  provider: string;
  small?: boolean;
}) {
  const known = ["wechat", "webhook", "vital", "inwit", "aimo"].includes(
    provider,
  );
  return (
    <span
      className={`provider ${known ? provider : ""} ${small ? "small" : ""}`}
      aria-hidden="true"
    >
      {provider === "wechat" || provider === "webhook" ? (
        <Icon name={provider} />
      ) : (
        ({ vital: "v", inwit: "i", aimo: "a" }[provider] ?? "·")
      )}
    </span>
  );
}

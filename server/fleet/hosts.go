package fleet

import (
	"context"
	"encoding/json"
	"time"
)

type HostStatus string

const (
	// StatusOnline host is active.
	StatusOnline = HostStatus("online")
	// StatusOffline no communication with host for OfflineDuration.
	StatusOffline = HostStatus("offline")
	// StatusMIA no communication with host for MIADuration.
	StatusMIA = HostStatus("mia")
	// StatusNew means the host has enrolled in the interval defined by
	// NewDuration. It is independent of offline and online.
	StatusNew = HostStatus("new")

	// NewDuration if a host has been created within this time period it's
	// considered new.
	NewDuration = 24 * time.Hour

	// MIADuration if a host hasn't been in communication for this period it
	// is considered MIA.
	MIADuration = 30 * 24 * time.Hour

	// OnlineIntervalBuffer is the additional time in seconds to add to the
	// online interval to avoid flapping of hosts that check in a bit later
	// than their expected checkin interval.
	OnlineIntervalBuffer = 30
)

type HostStore interface {
	// NewHost is deprecated and will be removed. Hosts should always be
	// enrolled via EnrollHost.
	NewHost(host *Host) (*Host, error)
	SaveHost(host *Host) error
	DeleteHost(hid uint) error
	Host(id uint) (*Host, error)
	// EnrollHost will enroll a new host with the given identifier, setting the
	// node key, and team. Implementations of this method should respect the
	// provided host enrollment cooldown, by returning an error if the host has
	// enrolled within the cooldown period.
	EnrollHost(osqueryHostId, nodeKey string, teamID *uint, cooldown time.Duration) (*Host, error)
	ListHosts(filter TeamFilter, opt HostListOptions) ([]*Host, error)
	// AuthenticateHost authenticates and returns host metadata by node key.
	// This method should not return the host "additional" information as this
	// is not typically necessary for the operations performed by the osquery
	// endpoints.
	AuthenticateHost(nodeKey string) (*Host, error)
	MarkHostSeen(host *Host, t time.Time) error
	MarkHostsSeen(hostIDs []uint, t time.Time) error
	SearchHosts(filter TeamFilter, query string, omit ...uint) ([]*Host, error)
	// CleanupIncomingHosts deletes hosts that have enrolled but never
	// updated their status details. This clears dead "incoming hosts" that
	// never complete their registration.
	//
	// A host is considered incoming if both the hostname and
	// osquery_version fields are empty. This means that multiple different
	// osquery queries failed to populate details.
	CleanupIncomingHosts(now time.Time) error
	// GenerateHostStatusStatistics retrieves the count of online, offline,
	// MIA and new hosts.
	GenerateHostStatusStatistics(filter TeamFilter, now time.Time) (online, offline, mia, new uint, err error)
	// HostIDsByName Retrieve the IDs associated with the given hostnames
	HostIDsByName(filter TeamFilter, hostnames []string) ([]uint, error)
	// HostByIdentifier returns one host matching the provided identifier.
	// Possible matches can be on osquery_host_identifier, node_key, UUID, or
	// hostname.
	HostByIdentifier(identifier string) (*Host, error)
	// AddHostsToTeam adds hosts to an existing team, clearing their team
	// settings if teamID is nil.
	AddHostsToTeam(teamID *uint, hostIDs []uint) error
	// SaveHostAdditional saves the information generated by the
	// additional_queries.
	SaveHostAdditional(host *Host) error
}

type HostService interface {
	ListHosts(ctx context.Context, opt HostListOptions) (hosts []*Host, err error)
	GetHost(ctx context.Context, id uint) (host *HostDetail, err error)
	GetHostSummary(ctx context.Context) (summary *HostSummary, err error)
	DeleteHost(ctx context.Context, id uint) (err error)
	// HostByIdentifier returns one host matching the provided identifier.
	// Possible matches can be on osquery_host_identifier, node_key, UUID, or
	// hostname.
	HostByIdentifier(ctx context.Context, identifier string) (*HostDetail, error)
	// RefetchHost requests a refetch of host details for the provided host.
	RefetchHost(ctx context.Context, id uint) (err error)

	FlushSeenHosts(ctx context.Context) error
	// AddHostsToTeam adds hosts to an existing team, clearing their team
	// settings if teamID is nil.
	AddHostsToTeam(ctx context.Context, teamID *uint, hostIDs []uint) error
	// AddHostsToTeamByFilter adds hosts to an existing team, clearing their
	// team settings if teamID is nil. Hosts are selected by the label and
	// HostListOptions provided.
	AddHostsToTeamByFilter(ctx context.Context, teamID *uint, opt HostListOptions, lid *uint) error
}

type HostListOptions struct {
	ListOptions

	// AdditionalFilters selects which host additional fields should be
	// populated.
	AdditionalFilters []string
	// StatusFilter selects the online status of the hosts.
	StatusFilter HostStatus
}

type HostUser struct {
	ID        uint   `json:"id" db:"id"`
	Uid       uint   `json:"uid" db:"uid"`
	Username  string `json:"username" db:"username"`
	Type      string `json:"type" db:"user_type"`
	GroupName string `json:"groupname" db:"groupname"`
}

type Host struct {
	UpdateCreateTimestamps
	HostSoftware
	ID uint `json:"id"`
	// OsqueryHostID is the key used in the request context that is
	// used to retrieve host information.  It is sent from osquery and may currently be
	// a GUID or a Host Name, but in either case, it MUST be unique
	OsqueryHostID    string        `json:"-" db:"osquery_host_id"`
	DetailUpdatedAt  time.Time     `json:"detail_updated_at" db:"detail_updated_at"` // Time that the host details were last updated
	LabelUpdatedAt   time.Time     `json:"label_updated_at" db:"label_updated_at"`   // Time that the host labels were last updated
	LastEnrolledAt   time.Time     `json:"last_enrolled_at" db:"last_enrolled_at"`   // Time that the host last enrolled
	SeenTime         time.Time     `json:"seen_time" db:"seen_time"`                 // Time that the host was last "seen"
	RefetchRequested bool          `json:"refetch_requested" db:"refetch_requested"`
	NodeKey          string        `json:"-" db:"node_key"`
	Hostname         string        `json:"hostname" db:"hostname"` // there is a fulltext index on this field
	UUID             string        `json:"uuid" db:"uuid"`         // there is a fulltext index on this field
	Platform         string        `json:"platform"`
	OsqueryVersion   string        `json:"osquery_version" db:"osquery_version"`
	OSVersion        string        `json:"os_version" db:"os_version"`
	Build            string        `json:"build"`
	PlatformLike     string        `json:"platform_like" db:"platform_like"`
	CodeName         string        `json:"code_name" db:"code_name"`
	Uptime           time.Duration `json:"uptime"`
	Memory           int64         `json:"memory" sql:"type:bigint" db:"memory"`
	// system_info fields
	CPUType          string `json:"cpu_type" db:"cpu_type"`
	CPUSubtype       string `json:"cpu_subtype" db:"cpu_subtype"`
	CPUBrand         string `json:"cpu_brand" db:"cpu_brand"`
	CPUPhysicalCores int    `json:"cpu_physical_cores" db:"cpu_physical_cores"`
	CPULogicalCores  int    `json:"cpu_logical_cores" db:"cpu_logical_cores"`
	HardwareVendor   string `json:"hardware_vendor" db:"hardware_vendor"`
	HardwareModel    string `json:"hardware_model" db:"hardware_model"`
	HardwareVersion  string `json:"hardware_version" db:"hardware_version"`
	HardwareSerial   string `json:"hardware_serial" db:"hardware_serial"`
	ComputerName     string `json:"computer_name" db:"computer_name"`
	// PrimaryNetworkInterfaceID if present indicates to primary network for the host, the details of which
	// can be found in the NetworkInterfaces element with the same ip_address.
	PrimaryNetworkInterfaceID *uint               `json:"primary_ip_id,omitempty" db:"primary_ip_id"`
	NetworkInterfaces         []*NetworkInterface `json:"-" db:"-"`
	PrimaryIP                 string              `json:"primary_ip" db:"primary_ip"`
	PrimaryMac                string              `json:"primary_mac" db:"primary_mac"`
	DistributedInterval       uint                `json:"distributed_interval" db:"distributed_interval"`
	ConfigTLSRefresh          uint                `json:"config_tls_refresh" db:"config_tls_refresh"`
	LoggerTLSPeriod           uint                `json:"logger_tls_period" db:"logger_tls_period"`
	TeamID                    *uint               `json:"team_id" db:"team_id"`

	// Loaded via JOIN in DB
	PackStats []PackStats `json:"pack_stats"`
	// TeamName is the name of the team, loaded by JOIN to the teams table.
	TeamName *string `json:"team_name" db:"team_name"`
	// Additional is the additional information from the host
	// additional_queries. This should be stored in a separate DB table.
	Additional *json.RawMessage `json:"additional,omitempty" db:"additional"`

	// Users currently in the host
	Users []HostUser `json:"users,omitempty"`

	Modified bool `json:"-"`
}

func (h Host) AuthzType() string {
	return "host"
}

// HostDetail provides the full host metadata along with associated labels and
// packs.
type HostDetail struct {
	Host
	// Labels is the list of labels the host is a member of.
	Labels []*Label `json:"labels"`
	// Packs is the list of packs the host is a member of.
	Packs []*Pack `json:"packs"`
}

const (
	HostKind = "host"
)

// HostSummary is a structure which represents a data summary about the total
// set of hosts in the database. This structure is returned by the HostService
// method GetHostSummary
type HostSummary struct {
	OnlineCount  uint `json:"online_count"`
	OfflineCount uint `json:"offline_count"`
	MIACount     uint `json:"mia_count"`
	NewCount     uint `json:"new_count"`
}

// Status calculates the online status of the host
func (h *Host) Status(now time.Time) HostStatus {
	// The logic in this function should remain synchronized with
	// GenerateHostStatusStatistics and CountHostsInTargets

	onlineInterval := h.ConfigTLSRefresh
	if h.DistributedInterval < h.ConfigTLSRefresh {
		onlineInterval = h.DistributedInterval
	}

	// Add a small buffer to prevent flapping
	onlineInterval += OnlineIntervalBuffer

	switch {
	case h.SeenTime.Add(MIADuration).Before(now):
		return StatusMIA
	case h.SeenTime.Add(time.Duration(onlineInterval) * time.Second).Before(now):
		return StatusOffline
	default:
		return StatusOnline
	}
}

func (h *Host) IsNew(now time.Time) bool {
	withDuration := h.CreatedAt.Add(NewDuration)
	if withDuration.After(now) ||
		withDuration.Equal(now) {
		return true
	}
	return false
}

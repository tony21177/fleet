import React from "react";

import HeaderCell from "components/TableContainer/DataTable/HeaderCell/HeaderCell";
import StatusCell from "components/TableContainer/DataTable/StatusCell/StatusCell";
import TextCell from "components/TableContainer/DataTable/TextCell/TextCell";
import { IInvite } from "interfaces/invite";
import { IUser } from "interfaces/user";
import { ITeam } from "interfaces/team";
import { IDropdownOption } from "interfaces/dropdownOption";
import stringUtils from "utilities/strings";
import DropdownCell from "../../../components/TableContainer/DataTable/DropdownCell";

interface IHeaderProps {
  column: {
    title: string;
    isSortedDesc: boolean;
  };
}

interface ICellProps {
  cell: {
    value: any;
  };
  row: {
    original: IUser | IInvite;
  };
}

interface IDataColumn {
  title: string;
  Header: ((props: IHeaderProps) => JSX.Element) | string;
  accessor: string;
  Cell: (props: ICellProps) => JSX.Element;
  disableHidden?: boolean;
  disableSortBy?: boolean;
}

interface IUserTableData {
  name: string;
  status: string;
  email: string;
  teams: string;
  roles: string;
  actions: IDropdownOption[];
  id: number;
  type: string;
}

// NOTE: cellProps come from react-table
// more info here https://react-table.tanstack.com/docs/api/useTable#cell-properties
const generateTableHeaders = (
  actionSelectHandler: (value: string, user: IUser | IInvite) => void,
  isBasicTier = false
): IDataColumn[] => {
  const tableHeaders: IDataColumn[] = [
    {
      title: "Name",
      Header: (cellProps) => (
        <HeaderCell
          value={cellProps.column.title}
          isSortedDesc={cellProps.column.isSortedDesc}
        />
      ),
      accessor: "name",
      Cell: (cellProps) => <TextCell value={cellProps.cell.value} />,
    },
    // TODO: need to add this info to API
    {
      title: "Status",
      Header: "Status",
      disableSortBy: true,
      accessor: "status",
      Cell: (cellProps) => <StatusCell value={cellProps.cell.value} />,
    },
    {
      title: "Email",
      Header: (cellProps) => (
        <HeaderCell
          value={cellProps.column.title}
          isSortedDesc={cellProps.column.isSortedDesc}
        />
      ),
      accessor: "email",
      Cell: (cellProps) => <TextCell value={cellProps.cell.value} />,
    },
    {
      title: "Roles",
      Header: "Roles",
      accessor: "roles",
      disableSortBy: true,
      Cell: (cellProps) => <TextCell value={cellProps.cell.value} />,
    },
    {
      title: "Actions",
      Header: "",
      disableSortBy: true,
      accessor: "actions",
      Cell: (cellProps) => (
        <DropdownCell
          options={cellProps.cell.value}
          onChange={(value: string) =>
            actionSelectHandler(value, cellProps.row.original)
          }
          placeholder={"Actions"}
        />
      ),
    },
  ];

  // Add Teams tab for basic tier only
  if (isBasicTier) {
    tableHeaders.splice(3, 0, {
      title: "Teams",
      Header: "Teams",
      accessor: "teams",
      disableSortBy: true,
      Cell: (cellProps) => <TextCell value={cellProps.cell.value} />,
    });
  }

  return tableHeaders;
};

// TODO: need to rethink status data.
const generateStatus = (type: string, data: IUser | IInvite): string => {
  const { teams, global_role } = data;
  if (global_role === null && teams.length === 0) {
    return "No Access";
  }

  return type === "invite" ? "Invite pending" : "Active";
};

const generateTeam = (teams: ITeam[], globalRole: string | null): string => {
  if (globalRole === null) {
    if (teams.length === 0) {
      // no global role and no teams
      return "No Team";
    } else if (teams.length === 1) {
      // no global role and only one team
      return teams[0].name;
    }
    return `${teams.length} teams`; // no global role and multiple teams
  }

  if (teams.length === 0) {
    // global role and no teams
    return "Global";
  }
  return `${teams.length + 1} teams`; // global role and one or more teams
};

const generateRole = (teams: ITeam[], globalRole: string | null): string => {
  if (globalRole === null) {
    const listOfRoles: any = teams.map((team) => team.role);

    if (teams.length === 0) {
      // no global role and no teams
      return "Unassigned";
    } else if (teams.length === 1) {
      // no global role and only one team
      return stringUtils.capitalize(teams[0].role ?? "");
    } else if (
      listOfRoles.every((role: string): boolean => role === "maintainer")
    ) {
      // only team maintainers
      return stringUtils.capitalize(teams[0].role ?? "");
    } else if (
      listOfRoles.every((role: string): boolean => role === "observer")
    ) {
      // only team observers
      return stringUtils.capitalize(teams[0].role ?? "");
    }

    return "Various"; // no global role and multiple teams
  }

  if (teams.length === 0) {
    // global role and no teams
    return stringUtils.capitalize(globalRole);
  }
  return "Various"; // global role and one or more teams
};

const generateActionDropdownOptions = (
  isCurrentUser: boolean,
  isInvitePending: boolean,
  isSsoEnabled: boolean
): IDropdownOption[] => {
  let dropdownOptions = [
    {
      label: "Edit",
      disabled: isInvitePending,
      value: isCurrentUser ? "editMyAccount" : "edit",
    },
    {
      label: "Require password reset",
      disabled: isInvitePending,
      value: "passwordReset",
    },
    {
      label: "Reset sessions",
      disabled: isInvitePending,
      value: "resetSessions",
    },
    {
      label: "Delete",
      disabled: isCurrentUser,
      value: "delete",
    },
  ];
  if (isSsoEnabled) {
    // remove "Require password reset" from dropdownOptions
    dropdownOptions = dropdownOptions.filter(
      (option) => option.label !== "Require password reset"
    );
  }
  return dropdownOptions;
};

const enhanceUserData = (
  users: IUser[],
  currentUserId: number
): IUserTableData[] => {
  return users.map((user) => {
    return {
      name: user.name || "---",
      status: generateStatus("user", user),
      email: user.email,
      teams: generateTeam(user.teams, user.global_role),
      roles: generateRole(user.teams, user.global_role),
      actions: generateActionDropdownOptions(
        user.id === currentUserId,
        false,
        user.sso_enabled
      ),
      id: user.id,
      type: "user",
    };
  });
};

const enhanceInviteData = (invites: IInvite[]): IUserTableData[] => {
  return invites.map((invite) => {
    return {
      name: invite.name || "---",
      status: generateStatus("invite", invite),
      email: invite.email,
      teams: generateTeam(invite.teams, invite.global_role),
      roles: generateRole(invite.teams, invite.global_role),
      actions: generateActionDropdownOptions(false, true, invite.sso_enabled),
      id: invite.id,
      type: "invite",
    };
  });
};

const combineDataSets = (
  users: IUser[],
  invites: IInvite[],
  currentUserId: number
): IUserTableData[] => {
  return [
    ...enhanceUserData(users, currentUserId),
    ...enhanceInviteData(invites),
  ];
};

export { generateTableHeaders, combineDataSets };
